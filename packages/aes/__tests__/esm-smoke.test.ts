import { gcm, cbc, aeskw } from "@noble/ciphers/aes.js";
import { FlattenedEncrypt, flattenedDecrypt } from "jose";
import { describe, expect, test } from "vitest";

describe("ESM import smoke test", () => {
  test("should import @noble/ciphers", () => {
    expect(gcm).toBeDefined();
    expect(cbc).toBeDefined();
    expect(aeskw).toBeDefined();
  });

  test("should import jose", () => {
    expect(FlattenedEncrypt).toBeDefined();
    expect(flattenedDecrypt).toBeDefined();
  });
});
