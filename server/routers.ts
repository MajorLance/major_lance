import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import {
  completePixChargeRequest,
  applySyncPayWebhook,
  createCustomerProfile,
  failPixChargeRequest,
  createManualBid,
  creditWalletDepositBypass,
  ensureCurrentRound,
  getPixChargeForUser,
  getCustomerProfileById,
  getCustomerProfiles,
  getWalletBalance,
  getWalletTransactions,
  isPaymentBypassEnabled,
  requestWalletWithdrawal,
  getPublicAuctionState,
  isCurrentRound,
  reservePixChargeRequest,
  normalizePixStatus,
  shouldConfirmPaymentBypass,
} from "./db";
import { createSyncPayCashIn, getSyncPayTransactionStatus } from "./syncpay";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_MS,
  createAdminSessionToken,
  verifyAdminCredentials,
  getAdminFromRequest,
} from "./_core/adminAuth";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";

const money = z.number().finite().positive().max(1_000_000);

function getWebhookUrl(req: {
  protocol: string;
  get: (name: string) => string | undefined;
  header: (name: string) => string | undefined;
}) {
  const configured = process.env.SYNCPAY_WEBHOOK_URL?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === "http:" || parsed.protocol === "https:")
        return parsed.toString();
    } catch {
      // Use the current public request host when the configured value is malformed.
    }
  }
  const host = req.get("host");
  if (!host) throw new Error("Host público não identificado");
  const forwardedProtocol = req
    .header("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProtocol === "http" ||
    (req.protocol === "http" && !forwardedProtocol)
      ? "http"
      : "https";
  return `${protocol}://${host}/api/syncpay/webhook`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  auction: router({
    state: publicProcedure.query(() => getPublicAuctionState()),
  }),

  customer: router({
    create: publicProcedure
      .input(
        z.object({
          fullName: z.string().trim().min(3).max(120),
          whatsapp: z.string().trim().min(8).max(30),
          pixKeyType: z.enum(["cpf", "email", "phone", "random"]),
          pixKey: z.string().trim().min(3).max(160),
        }),
      )
      .mutation(({ input }) => createCustomerProfile(input)),
  }),

  admin: router({
    me: publicProcedure.query(async ({ ctx }) => {
      const admin = await getAdminFromRequest(ctx.req as any);
      if (!admin) return null;
      return admin;
    }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1).max(128),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!verifyAdminCredentials(input.email, input.password)) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-mail ou senha inválidos",
          });
        }
        const token = await createAdminSessionToken(input.email);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(ADMIN_COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ADMIN_SESSION_MAX_AGE_MS,
        });
        return { success: true, email: input.email.toLowerCase() } as const;
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(ADMIN_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    dashboard: adminProcedure.query(() => getPublicAuctionState()),
    customers: adminProcedure.query(() => getCustomerProfiles()),
    createManualBid: adminProcedure
      .input(
        z.object({
          roundId: z.string().min(1).max(64),
          name: z.string().trim().min(2).max(120),
          amount: money,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const adminIdentifier =
            ctx.admin?.email ?? ctx.user?.email ?? ctx.admin?.email ?? "admin";
          // Use a stable numeric id for admin env: hash email or 0
          let createdByUserId = ctx.user?.id ?? 0;
          if (!createdByUserId && ctx.admin) {
            createdByUserId = 0;
          }
          return await createManualBid({
            roundId: input.roundId,
            name: input.name,
            amount: Number(input.amount.toFixed(2)),
            createdByUserId,
          });
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error
                ? error.message
                : "Não foi possível inserir o lance",
          });
        }
      }),
  }),

  wallet: router({
    balance: publicProcedure
      .input(z.object({ customerId: z.number().int().positive() }))
      .query(({ input }) => getWalletBalance(input.customerId)),
    transactions: publicProcedure
      .input(z.object({ customerId: z.number().int().positive() }))
      .query(({ input }) => getWalletTransactions(input.customerId)),
    requestWithdrawal: publicProcedure
      .input(
        z.object({
          customerId: z.number().int().positive(),
          amount: money,
          requestKey: z.string().min(16).max(64),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await requestWalletWithdrawal(input);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error
                ? error.message
                : "Não foi possível registrar o saque",
          });
        }
      }),
    createPixCharge: publicProcedure
      .input(
        z.object({
          amount: money,
          roundId: z.string().min(1).max(64),
          requestKey: z.string().min(16).max(64),
          customerId: z.number().int().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const customer = await getCustomerProfileById(input.customerId);
        if (!customer)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Cadastro de cliente não encontrado",
          });
        const activeRound = await ensureCurrentRound();
        if (!isCurrentRound(input.roundId, activeRound.id)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A rodada mudou. Atualize a página e tente novamente.",
          });
        }

        const reservation = await reservePixChargeRequest({
          requestKey: input.requestKey,
          userId: input.customerId,
          roundId: activeRound.id,
          amount: Number(input.amount.toFixed(2)),
        });

        if (!reservation.isNew) {
          if (reservation.charge.pixCode) {
            return {
              identifier: reservation.charge.identifier,
              pixCode: reservation.charge.pixCode,
              amount: Number(reservation.charge.amount),
              status: reservation.charge.status,
            } as const;
          }
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Esta cobrança Pix já está sendo criada. Tente novamente em alguns segundos.",
          });
        }

        if (isPaymentBypassEnabled()) {
          try {
            const charge = await completePixChargeRequest({
              requestKey: input.requestKey,
              identifier: input.requestKey,
              pixCode: `BYPASS-${input.requestKey}`,
            });
            return {
              identifier: charge.identifier,
              pixCode: charge.pixCode,
              amount: Number(charge.amount),
              status: charge.status,
            };
          } catch (error) {
            await failPixChargeRequest(input.requestKey);
            console.error("[Bypass] Falha ao criar cobrança bypass", error);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                error instanceof Error
                  ? error.message
                  : "Não foi possível gerar o Pix bypass",
            });
          }
        }

        try {
          const providerCharge = await createSyncPayCashIn({
            amount: Number(input.amount.toFixed(2)),
            description: `Lance ${activeRound.id}`,
            webhookUrl: getWebhookUrl(ctx.req),
          });
          const charge = await completePixChargeRequest({
            requestKey: input.requestKey,
            identifier: providerCharge.identifier,
            pixCode: providerCharge.pix_code,
          });

          return {
            identifier: charge.identifier,
            pixCode: charge.pixCode,
            amount: Number(charge.amount),
            status: charge.status,
          } as const;
        } catch (error) {
          await failPixChargeRequest(input.requestKey);
          console.error("[SyncPay] Falha ao criar cobrança Pix", error);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error
                ? error.message
                : "Não foi possível gerar o Pix",
          });
        }
      }),

    pixChargeStatus: publicProcedure
      .input(
        z.object({
          identifier: z.string().min(1).max(64),
          customerId: z.number().int().positive(),
        }),
      )
      .query(async ({ input }) => {
        try {
          const charge = await getPixChargeForUser(
            input.identifier,
            input.customerId,
          );
          if (!charge)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Cobrança não encontrada",
            });
          if (charge.status === "pending") {
            if (isPaymentBypassEnabled()) {
              if (
                !shouldConfirmPaymentBypass({
                  createdAt: charge.createdAt,
                  key: charge.requestKey,
                })
              ) {
                return {
                  identifier: charge.identifier,
                  amount: Number(charge.amount),
                  status: charge.status,
                } as const;
              }
              try {
                const updated = await applySyncPayWebhook({
                  identifier: charge.identifier,
                  status: "paid",
                  amount: Number(charge.amount),
                  payload: { bypass: true, statusQuery: true },
                });
                await creditWalletDepositBypass({
                  customerId: input.customerId,
                  amount: Number(charge.amount),
                  requestKey: charge.requestKey,
                });
                if (updated)
                  return {
                    identifier: updated.identifier,
                    amount: Number(updated.amount),
                    status: updated.status,
                  } as const;
              } catch (bypassError) {
                console.warn(
                  "[Bypass] Falha ao auto-confirmar cobrança pendente",
                  bypassError,
                );
              }
            }
            try {
              const providerStatus = await getSyncPayTransactionStatus(
                charge.identifier,
              );
              const normalized = normalizePixStatus(
                providerStatus.data?.status,
              );
              if (normalized && normalized !== charge.status) {
                const updated = await applySyncPayWebhook({
                  identifier: charge.identifier,
                  status: normalized,
                  amount: providerStatus.data?.amount,
                  payload: providerStatus,
                });
                if (updated)
                  return {
                    identifier: updated.identifier,
                    amount: Number(updated.amount),
                    status: updated.status,
                  } as const;
              }
            } catch (providerError) {
              console.warn(
                "[SyncPay] Consulta de fallback indisponível; aguardando webhook",
                providerError,
              );
            }
          }
          return {
            identifier: charge.identifier,
            amount: Number(charge.amount),
            status: charge.status,
          } as const;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[SyncPay] Falha ao consultar cobrança Pix", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Não foi possível consultar o Pix",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
