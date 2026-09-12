import type { Express, Request, Response } from "express";
import { applySyncPayWebhook, normalizePixStatus } from "./db";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function readPath(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    const record = asRecord(value);
    return record?.[key];
  }, payload);
}

function firstString(payload: unknown, paths: string[]) {
  for (const path of paths) {
    const value = readPath(payload, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function firstNumber(payload: unknown, paths: string[]) {
  for (const path of paths) {
    const value = readPath(payload, path);
    const number = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

export function isAuthorizedWebhook(req: Request) {
  const expected = process.env.SYNCPAY_WEBHOOK_SECRET?.trim();
  // O SyncPay não envia um token customizado quando ele não é configurado no painel.
  // Nesse caso, a cobrança é localizada pelo identificador aleatório persistido no banco.
  if (!expected) return true;

  const authorization = req.header("authorization")?.trim();
  const bearer = authorization?.replace(/^Bearer\s+/i, "");
    const provided = bearer || req.header("x-webhook-token")?.trim() || req.header("x-syncpay-token")?.trim();
  return provided === expected;
}

export function isSyntheticSyncPayTestPayload(payload: unknown) {
  const record = asRecord(payload);
  const message = firstString(payload, ["message", "data.message"]);
  if (!record || message !== "This is a test webhook payload.") return false;

  const hasTransactionMarker = [
    "id",
    "identifier",
    "status",
    "data.id",
    "data.identifier",
    "data.status",
    "transaction.id",
    "transaction.identifier",
    "transaction.status",
  ].some(path => readPath(payload, path) !== undefined && readPath(payload, path) !== null);

  return !hasTransactionMarker;
}

export function registerSyncPayWebhook(app: Express) {
  app.post("/api/syncpay/webhook", async (req: Request, res: Response) => {
    const payload = req.body as unknown;

    // O botão “Enviar teste” da SyncPay envia apenas esta mensagem fixa.
    // O bypass é inofensivo: não há identifier/status e nada é alterado no banco.
    if (isSyntheticSyncPayTestPayload(payload)) {
      res.status(200).json({ received: true, test: true, source: "syncpay" });
      return;
    }

    if (!isAuthorizedWebhook(req)) {
      res.status(401).json({ error: "Webhook não autorizado" });
      return;
    }

    const identifier = firstString(payload, [
      "identifier",
      "id",
      "transaction_id",
      "payment_id",
      "txid",
      "data.identifier",
      "data.id",
      "data.transaction_id",
      "data.payment_id",
      "data.txid",
      "transaction.identifier",
      "transaction.id",
      "transaction.transaction_id",
      "transaction.payment_id",
      "payment.identifier",
      "payment.id",
    ]);
    const rawStatus = firstString(payload, [
      "status",
      "payment_status",
      "data.status",
      "data.payment_status",
      "transaction.status",
      "transaction.payment_status",
      "payment.status",
      "event_status",
      "event",
      "type",
    ]) ?? (asRecord(payload)?.paid === true || asRecord(payload)?.payment_confirmed === true ? "paid" : undefined);
    const status = normalizePixStatus(rawStatus);

    if (!identifier || !status) {
      console.warn("[SyncPay] Webhook ignorado: identifier/status ausente", { identifier, rawStatus });
      res.status(200).json({ received: true });
      return;
    }

    try {
      const charge = await applySyncPayWebhook({
        identifier,
        status,
        amount: firstNumber(payload, ["amount", "final_amount", "data.amount", "data.final_amount", "transaction.amount", "payment.amount"]),
        payload,
      });

      if (!charge) {
        console.warn("[SyncPay] Webhook recebido para cobrança desconhecida", { identifier, status });
      } else {
        console.log("[SyncPay] Cobrança atualizada", { identifier, status });
      }

      // A SyncPay considera qualquer resposta 2XX como entrega aceita.
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[SyncPay] Falha ao processar webhook", error);
      res.status(400).json({ error: "Webhook inválido" });
    }
  });
}
