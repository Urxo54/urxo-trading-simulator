export type TradingInstrument = "eurusd" | "xauusd" | "usatechidxusd";
export type TradeSide = "BUY" | "SELL";

const contractSize: Record<TradingInstrument, number> = {
  eurusd: 100000,
  xauusd: 100,
  usatechidxusd: 1,
};

export function calculateTradePnl(
  instrument: TradingInstrument,
  side: TradeSide,
  volume: number,
  entry: number,
  mark: number,
): number {
  const direction = side === "BUY" ? 1 : -1;
  return (mark - entry) * direction * volume * contractSize[instrument];
}

/** Returns the conservative exit price when a replay candle reaches SL or TP. */
export function getTriggeredExit(
  side: TradeSide,
  mark: number,
  stopLoss: number | null,
  takeProfit: number | null,
): { reason: "stop-loss" | "take-profit"; price: number } | null {
  const hitStop = stopLoss !== null && (side === "BUY" ? mark <= stopLoss : mark >= stopLoss);
  const hitTarget = takeProfit !== null && (side === "BUY" ? mark >= takeProfit : mark <= takeProfit);
  if (hitStop) return { reason: "stop-loss", price: stopLoss };
  if (hitTarget) return { reason: "take-profit", price: takeProfit };
  return null;
}

export function isValidOrderLevels(
  side: TradeSide,
  entry: number,
  stopLoss: number | null,
  takeProfit: number | null,
): boolean {
  if (!Number.isFinite(entry) || entry <= 0) return false;
  if (stopLoss !== null && (!Number.isFinite(stopLoss) || stopLoss <= 0)) return false;
  if (takeProfit !== null && (!Number.isFinite(takeProfit) || takeProfit <= 0)) return false;
  if (side === "BUY") return (stopLoss === null || stopLoss < entry) && (takeProfit === null || takeProfit > entry);
  return (stopLoss === null || stopLoss > entry) && (takeProfit === null || takeProfit < entry);
}
