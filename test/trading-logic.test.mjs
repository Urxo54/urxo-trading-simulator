import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateTradePnl,
  getTriggeredExit,
  isValidOrderLevels,
} from "../src/lib/trading-logic.ts";

test("calculates BUY and SELL P/L using the configured contract sizes", () => {
  assert.equal(calculateTradePnl("eurusd", "BUY", 0.1, 1.1, 1.101), 10);
  assert.equal(calculateTradePnl("eurusd", "SELL", 0.1, 1.1, 1.099), 10);
  assert.equal(calculateTradePnl("xauusd", "BUY", 1, 2000, 2001), 100);
  assert.equal(calculateTradePnl("usatechidxusd", "SELL", 2, 18000, 17990), 20);
});

test("validates stop loss and take profit on the correct side of entry", () => {
  assert.equal(isValidOrderLevels("BUY", 1.1, 1.09, 1.12), true);
  assert.equal(isValidOrderLevels("SELL", 1.1, 1.12, 1.08), true);
  assert.equal(isValidOrderLevels("BUY", 1.1, 1.11, 1.12), false);
  assert.equal(isValidOrderLevels("SELL", 1.1, 1.09, 1.08), false);
  assert.equal(isValidOrderLevels("BUY", 0, null, null), false);
});

test("triggers BUY and SELL exits when replay candle wicks touch the levels", () => {
  assert.deepEqual(getTriggeredExit("BUY", 1.105, 1.09, 1.11, 1.112, 1.088), {
    reason: "stop-loss",
    price: 1.09,
  });
  assert.deepEqual(getTriggeredExit("SELL", 1.095, 1.11, 1.09, 1.112, 1.088), {
    reason: "stop-loss",
    price: 1.11,
  });
  assert.deepEqual(getTriggeredExit("BUY", 1.105, 1.09, 1.11, 1.112, 1.095), {
    reason: "take-profit",
    price: 1.11,
  });
});

test("uses conservative stop-loss outcome when one candle crosses both SL and TP", () => {
  assert.deepEqual(getTriggeredExit("BUY", 1.1, 1.09, 1.11, 1.12, 1.08), {
    reason: "stop-loss",
    price: 1.09,
  });
});

test("does not close a position when neither level was reached", () => {
  assert.equal(getTriggeredExit("BUY", 1.105, 1.09, 1.11, 1.108, 1.102), null);
});
