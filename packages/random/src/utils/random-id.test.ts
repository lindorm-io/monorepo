import { randomId } from "./random-id.js";
import { describe, expect, test } from "vitest";

describe("randomId", () => {
  test("should resolve default", () => {
    const id = randomId();

    expect(id).toEqual(expect.any(String));
    expect(id.length).toEqual(22);
  });

  test("should resolve with namespace", () => {
    const id = randomId("client");

    expect(id).toEqual(expect.any(String));
    expect(id).toMatch(/^client~/);
    expect(id.length).toEqual(29); // "client~" (7) + 22 base64url chars
  });

  test("should produce unique ids", () => {
    const a = randomId();
    const b = randomId();

    expect(a).not.toEqual(b);
  });

  test("should resolve with custom bytes via string overload", () => {
    const id = randomId("client", { bytes: 8 });

    expect(id).toEqual(expect.any(String));
    expect(id).toMatch(/^client~/);
    expect(id.length).toEqual(18); // "client~" (7) + 11 base64url chars
  });

  test("should resolve with options object", () => {
    const id = randomId({ namespace: "client", bytes: 8 });

    expect(id).toEqual(expect.any(String));
    expect(id).toMatch(/^client~/);
    expect(id.length).toEqual(18);
  });

  test("should resolve with bytes only via options object", () => {
    const id = randomId({ bytes: 8 });

    expect(id).toEqual(expect.any(String));
    expect(id.length).toEqual(11);
  });

  test("should be url-safe", () => {
    for (let i = 0; i < 100; i++) {
      expect(randomId()).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
  });
});
