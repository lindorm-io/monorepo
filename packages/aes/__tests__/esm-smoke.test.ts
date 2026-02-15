import { gcm, cbc, aeskw } from "@noble/ciphers/aes";
import { FlattenedEncrypt, flattenedDecrypt } from "jose";

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
