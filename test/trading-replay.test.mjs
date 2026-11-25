import assert from "node:assert/strict";
import test from "node:test";

import {
  findFirstPriceTouch,
  findFirstTradeExit,
  positionRightEdgeIndex,
} from "../src/lib/trading-replay.ts";

const candles = [
  { high: 101, low: 99 },
  { high: 105, low: 100 },
  { high: 103, low: 95 },
  { high: 110, low: 98 },
  { high: 104, low: 97 },
];

test("pending order fills on the first candle touching its entry", () => {
  assert.equal(findFirstPriceTouch(candles, 100, 1, 4), 1);
  assert.equal(findFirstPriceTouch(candles, 90, 0, 4), null);
});

test("long trade exits at the first take-profit candle", () => {
  assert.deepEqual(
    findFirstTradeExit(candles, { isLong: true, stopLoss: 90, takeProfit: 109 }, 1, 4),
    { index: 3, result: "take-profit" },
  );
});

test("short trade exits at the first stop-loss candle", () => {
  assert.deepEqual(
    findFirstTradeExit(candles, { isLong: false, stopLoss: 104, takeProfit: 90 }, 1, 4),
    { index: 1, result: "stop-loss" },
  );
});

test("stop-loss wins when both levels are touched by the same OHLC candle", () => {
  assert.deepEqual(
    findFirstTradeExit(candles, { isLong: true, stopLoss: 100, takeProfit: 104 }, 1, 4),
    { index: 1, result: "stop-loss" },
  );
});

test("fast-forward resolves the earliest exit rather than the requested final candle", () => {
  const exit = findFirstTradeExit(candles, { isLong: true, stopLoss: 94, takeProfit: 109 }, 1, 4);
  assert.deepEqual(exit, { index: 3, result: "take-profit" });
});

test("position width stays at 20 candles, then follows replay until closure", () => {
  assert.equal(positionRightEdgeIndex(10, 15, 100), 30);
  assert.equal(positionRightEdgeIndex(10, 30, 100), 30);
  assert.equal(positionRightEdgeIndex(10, 35, 100), 35);
  assert.equal(positionRightEdgeIndex(90, 99, 100), 99);
});
