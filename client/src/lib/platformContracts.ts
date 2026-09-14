import type { Bid, Round } from "./mockData";

export type BidSubmission = {
  roundId: string;
  amount: number;
};

export type BidSubmissionResult =
  | { status: "accepted"; paymentReference: string }
  | { status: "rejected"; reason: "ROUND_CLOSED" | "BID_TOO_LOW" | "INSUFFICIENT_BALANCE" | "PAYMENT_ERROR" };

export type WalletSnapshot = {
  availableBalance: number;
  pendingBalance: number;
};

export type WithdrawalRequest = {
  amount: number;
  pixKey: string;
};

/**
 * Interface a ser implementada com chamadas tRPC quando os serviços reais forem conectados.
 * Os componentes atuais consomem apenas modelos e regras de domínio, evitando dependência de UI.
 */
export interface MajorLanceGateway {
  getCurrentRound(): Promise<Round>;
  listRecentBids(roundId: string): Promise<Bid[]>;
  submitBid(input: BidSubmission): Promise<BidSubmissionResult>;
  getWallet(): Promise<WalletSnapshot>;
  requestWithdrawal(input: WithdrawalRequest): Promise<{ requestId: string }>;
}
