export type ReplayCandle = { high: number; low: number };
export type TradeExit = { index: number; result: "take-profit" | "stop-loss" };

export function findFirstPriceTouch(
  candles: readonly ReplayCandle[],
  price: number,
  fromIndex: number,
  toIndex: number,
): number | null {
  const start = Math.max(0, fromIndex);
  const end = Math.min(candles.length - 1, toIndex);
  for (let index = start; index <= end; index += 1) {
    const candle = candles[index];
    if (candle && candle.low <= price && candle.high >= price) return index;
  }
  return null;
}

export function findFirstTradeExit(
  candles: readonly ReplayCandle[],
  trade: { isLong: boolean; stopLoss: number; takeProfit: number },
  fromIndex: number,
  toIndex: number,
): TradeExit | null {
  const start = Math.max(0, fromIndex);
  const end = Math.min(candles.length - 1, toIndex);
  for (let index = start; index <= end; index += 1) {
    const candle = candles[index];
    if (!candle) continue;
    const hitStop = trade.isLong ? candle.low <= trade.stopLoss : candle.high >= trade.stopLoss;
    const hitTarget = trade.isLong ? candle.high >= trade.takeProfit : candle.low <= trade.takeProfit;
    // Conservative intrabar assumption: when both levels are touched,
    // stop-loss wins because OHLC candles do not reveal tick order.
    if (hitStop) return { index, result: "stop-loss" };
    if (hitTarget) return { index, result: "take-profit" };
  }
  return null;
}

export function positionRightEdgeIndex(
  triggerIndex: number,
  replayIndex: number,
  candleCount: number,
  initialWidth = 20,
): number {
  const initialRight = Math.min(triggerIndex + initialWidth, candleCount - 1);
  return replayIndex > triggerIndex + initialWidth
    ? Math.min(replayIndex, candleCount - 1)
    : initialRight;
}
