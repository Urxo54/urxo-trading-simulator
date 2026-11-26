export type TradeResult = "take-profit" | "stop-loss";

export type TradeHistoryItem = {
  id: string;
  instrument: string;
  timeframe: string;
  sessionTime: number;
  closeTime: number;
  result: TradeResult;
  pointsDelta: number;
  balanceAfter: number;
  rr?: number;
  marks: unknown[];
};

export type PointsAccount = { balance: number; trades: TradeHistoryItem[] };

const STORAGE_KEY = "urxo-points-account-v1";
export const STARTING_POINTS = 100;
export const TRADE_RISK_POINTS = 10;

export function calculateRoundedRR(entryPrice: number, stopLoss: number, takeProfit: number): number {
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  if (!Number.isFinite(risk) || !Number.isFinite(reward) || risk <= 0) return 0;
  return Math.max(0, Math.round(reward / risk));
}

export function readPointsAccount(): PointsAccount {
  if (typeof window === "undefined") return { balance: STARTING_POINTS, trades: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = { balance: STARTING_POINTS, trades: [] };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<PointsAccount>;
    if (!Array.isArray(parsed.trades) || typeof parsed.balance !== "number") throw new Error("Invalid points account");
    return { balance: parsed.balance, trades: parsed.trades };
  } catch {
    return { balance: STARTING_POINTS, trades: [] };
  }
}

export function recordCompletedTrade(trade: Omit<TradeHistoryItem, "pointsDelta" | "balanceAfter">): { account: PointsAccount; added: boolean; pointsDelta: number } {
  const account = readPointsAccount();
  const existing = account.trades.find((item) => item.id === trade.id);
  if (existing) return { account, added: false, pointsDelta: existing.pointsDelta };
  const rr = Number.isFinite(trade.rr) ? Math.max(0, Math.round(trade.rr ?? 0)) : 0;
  const pointsDelta = trade.result === "take-profit" ? TRADE_RISK_POINTS * rr : -TRADE_RISK_POINTS;
  const next: PointsAccount = {
    balance: account.balance + pointsDelta,
    trades: [{ ...trade, rr, pointsDelta, balanceAfter: account.balance + pointsDelta }, ...account.trades],
  };
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return { account: next, added: true, pointsDelta };
}

export function formatPoints(value: number): string {
  return `${value > 0 ? "+" : ""}${value} ${Math.abs(value) === 1 ? "point" : "points"}`;
}