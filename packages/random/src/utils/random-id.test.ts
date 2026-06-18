import { randomId } from "./random-id.js";
import { describe, expect, test } from "vitest";

describe("randomId", () => {
  test("should resolve default", () => {
    const id = randomId();

    expect(id).toEqual(expect.any(String));
    expect(id.length).toEqual(24);
  });

  test("should resolve with namespace", () => {
    const id = randomId("client");

    expect(id).toEqual(expect.any(String));
    expect(id).toMatch(/^client_/);
    expect(id.length).toEqual(31); // "client_" (7) + 24 base62 chars
  });

  test("should produce unique ids", () => {
    const a = randomId();
    const b = randomId();

    expect(a).not.toEqual(b);
  });

  test("should resolve with custom length via string overload", () => {
    const id = randomId("client", { length: 16 });

    expect(id).toEqual(expect.any(String));
    expect(id).toMatch(/^client_/);
    expect(id.length).toEqual(23); // "client_" (7) + 16 base62 chars
  });

  test("should resolve with options object", () => {
    const id = randomId({ namespace: "client", length: 16 });

    expect(id).toEqual(expect.any(String));
    expect(id).toMatch(/^client_/);
    expect(id.length).toEqual(23);
  });

  test("should resolve with length only via options object", () => {
    const id = randomId({ length: 16 });

    expect(id).toEqual(expect.any(String));
    expect(id.length).toEqual(16);
  });

  test("should resolve with maximum length", () => {
    const id = randomId({ length: 64 });

    expect(id).toEqual(expect.any(String));
    expect(id.length).toEqual(64);
  });

  test("should produce an alphanumeric body with no symbols", () => {
    for (let i = 0; i < 100; i++) {
      expect(randomId()).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  test("should keep the namespace separator out of the body", () => {
    for (let i = 0; i < 100; i++) {
      const id = randomId("client");
      const body = id.slice("client_".length);

      expect(body).toMatch(/^[A-Za-z0-9]+$/);
      expect(body).not.toContain("_");
    }
  });

  test("should accept an alphanumeric namespace", () => {
    expect(() => randomId("client")).not.toThrow();
    expect(() => randomId("Client0")).not.toThrow();
    expect(() => randomId({ namespace: "user1" })).not.toThrow();
  });

  test.each(["my_ns", "ns-1", "ns space", "ns.x", "", "ns!"])(
    "should reject a non-alphanumeric namespace: %j",
    (namespace) => {
      expect(() => randomId(namespace)).toThrow(/Invalid randomId namespace/);
    },
  );
});
