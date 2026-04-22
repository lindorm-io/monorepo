import { describe, expect, test } from "vitest";
import { combineSignals } from "./combine-signals.js";

describe("combineSignals", () => {
  test("should return undefined when neither signal is provided", () => {
    expect(combineSignals(undefined, undefined)).toBeUndefined();
  });

  test("should return a when only a is provided", () => {
    const a = new AbortController().signal;
    expect(combineSignals(a, undefined)).toBe(a);
  });

  test("should return b when only b is provided", () => {
    const b = new AbortController().signal;
    expect(combineSignals(undefined, b)).toBe(b);
  });

  test("should return a combined signal when both are provided", () => {
    const a = new AbortController().signal;
    const b = new AbortController().signal;
    const result = combineSignals(a, b);
    expect(result).toBeInstanceOf(AbortSignal);
    expect(result).not.toBe(a);
    expect(result).not.toBe(b);
    expect(result?.aborted).toBe(false);
  });

  test("should return an already-aborted signal when both inputs are already aborted", () => {
    const ca = new AbortController();
    const cb = new AbortController();
    ca.abort(new Error("a"));
    cb.abort(new Error("b"));
    const result = combineSignals(ca.signal, cb.signal);
    expect(result?.aborted).toBe(true);
  });

  test("should propagate abort from signal a", () => {
    const ca = new AbortController();
    const cb = new AbortController();
    const result = combineSignals(ca.signal, cb.signal);
    expect(result?.aborted).toBe(false);
    const reason = new Error("from-a");
    ca.abort(reason);
    expect(result?.aborted).toBe(true);
    expect(result?.reason).toBe(reason);
  });

  test("should propagate abort from signal b", () => {
    const ca = new AbortController();
    const cb = new AbortController();
    const result = combineSignals(ca.signal, cb.signal);
    expect(result?.aborted).toBe(false);
    const reason = new Error("from-b");
    cb.abort(reason);
    expect(result?.aborted).toBe(true);
    expect(result?.reason).toBe(reason);
  });
});
