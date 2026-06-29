import { describe, expect, test } from "vitest";
import type { EntityMetadata } from "../types/metadata.js";
import { assertSerialisableJsonFields } from "./assert-serialisable-json.js";

const meta = (
  fields: Array<
    Partial<{ key: string; type: string; typedJson: unknown; embedded: unknown }>
  >,
) => ({ fields }) as unknown as EntityMetadata;

const plainJson = meta([{ key: "payload", type: "json" }]);

describe("assertSerialisableJsonFields", () => {
  test("allows plain JSON-native structures (objects, arrays, primitives, null)", () => {
    expect(() =>
      assertSerialisableJsonFields(plainJson, {
        payload: { a: 1, b: "x", c: [true, null, { d: 2 }], e: null },
      }),
    ).not.toThrow();
  });

  test("allows a null/undefined value", () => {
    expect(() =>
      assertSerialisableJsonFields(plainJson, { payload: null }),
    ).not.toThrow();
    expect(() =>
      assertSerialisableJsonFields(plainJson, { payload: undefined }),
    ).not.toThrow();
  });

  test.each([
    ["Date", { when: new Date() }],
    ["BigInt", { n: BigInt(1) }],
    ["Buffer", { buf: Buffer.from("x") }],
    ["Buffer (Uint8Array)", { buf: new Uint8Array([1, 2]) }],
    ["Map", { m: new Map([["k", 1]]) }],
    ["Set", { s: new Set([1, 2]) }],
  ])("throws on a nested %s in a plain json field", (_label, payload) => {
    expect(() => assertSerialisableJsonFields(plainJson, { payload })).toThrow(
      /plain json field "payload"/,
    );
  });

  test("error names the offending path and recommends @TypedJson", () => {
    let caught: any;
    try {
      assertSerialisableJsonFields(plainJson, {
        payload: { items: [{ at: new Date() }] },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    // path is in the message; the @TypedJson recommendation is in details
    expect(caught.message).toMatch(/payload\.items\[0\]\.at/);
    expect(caught.details).toMatch(/@TypedJson/);
    expect(caught.data).toMatchObject({ field: "payload", type: "Date" });
  });

  test("skips @TypedJson fields (handled losslessly via the sidecar)", () => {
    const typed = meta([
      { key: "payload", type: "json", typedJson: { column: "payload__typemeta" } },
    ]);
    expect(() =>
      assertSerialisableJsonFields(typed, { payload: { when: new Date() } }),
    ).not.toThrow();
  });

  test("ignores non-json fields (a Date in a real date column is fine)", () => {
    const dated = meta([{ key: "createdAt", type: "timestamp" }]);
    expect(() =>
      assertSerialisableJsonFields(dated, { createdAt: new Date() }),
    ).not.toThrow();
  });

  test("ignores embedded fields", () => {
    const embedded = meta([{ key: "address.city", type: "json", embedded: {} }]);
    expect(() =>
      assertSerialisableJsonFields(embedded, { address: { city: new Date() } }),
    ).not.toThrow();
  });
});
