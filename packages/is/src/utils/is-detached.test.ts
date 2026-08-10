import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isDetached } from "./is-detached.js";
import { createContext, runInContext } from "node:vm";
import { describe, expect, test } from "vitest";

const detachedArrayBuffer = (): ArrayBuffer => {
  const buffer = new ArrayBuffer(8);
  buffer.transfer();
  return buffer;
};

const context = createContext({});

describe("isDetached", () => {
  // No fixture is a detached buffer, so the matrix is asserted directly rather
  // than snapshotted — the snapshot would have to be regenerated every time a
  // fixture is added, for an answer that is `false` by construction.
  test.each(Object.entries(TEST_FIXTURES))("should reject fixture %s", (_, value) => {
    expect(isDetached(value)).toBe(false);
  });

  test("should accept a detached array buffer", () => {
    expect(isDetached(detachedArrayBuffer())).toBe(true);
  });

  test("should accept the detached buffer behind a view", () => {
    const view = new Uint8Array(8);
    view.buffer.transfer();

    expect(isDetached(view.buffer)).toBe(true);
  });

  // `instanceof` fails across realms; the `[object ArrayBuffer]` tag comes from
  // the internal slot and survives both the realm boundary and the detachment.
  test("should accept a detached array buffer from another realm", () => {
    const buffer = runInContext(
      "const buffer = new ArrayBuffer(8); buffer.transfer(); buffer;",
      context,
    );

    expect(buffer instanceof ArrayBuffer).toBe(false);
    expect(isDetached(buffer)).toBe(true);
  });

  test("should reject a live array buffer", () => {
    expect(isDetached(new ArrayBuffer(8))).toBe(false);
    expect(isDetached(new ArrayBuffer(0))).toBe(false);
    expect(isDetached(new Uint8Array(8).buffer)).toBe(false);
    expect(isDetached(runInContext("new ArrayBuffer(8)", context))).toBe(false);
  });

  // Shared memory cannot be detached, so `false` is the ANSWER, not a refusal:
  // `SharedArrayBuffer.prototype` carries no `detached` accessor at all.
  test("should reject a shared array buffer", () => {
    expect(isDetached(new SharedArrayBuffer(8))).toBe(false);
  });

  // Without the ArrayBuffer gate an ordinary data bag carrying the property
  // would answer `true`.
  test("should reject a value that merely claims to be detached", () => {
    expect(isDetached({ detached: true })).toBe(false);
    expect(isDetached({ detached: true, byteLength: 0 })).toBe(false);
  });

  test("should reject anything else", () => {
    expect(isDetached(new Uint8Array(8))).toBe(false);
    expect(isDetached(new DataView(new ArrayBuffer(8)))).toBe(false);
    expect(isDetached(Buffer.alloc(8))).toBe(false);
    expect(isDetached(null)).toBe(false);
    expect(isDetached(undefined)).toBe(false);
    expect(isDetached()).toBe(false);
  });
});
