import { describe, expect, test } from "vitest";
import { isEcdhEsAlgorithm } from "./is-ecdh-es-algorithm.js";

describe("isEcdhEsAlgorithm", () => {
  test("recognises the whole ECDH-ES family — direct AND the +A*KW variants", () => {
    for (const algorithm of [
      "ECDH-ES",
      "ECDH-ES+A128KW",
      "ECDH-ES+A192KW",
      "ECDH-ES+A256KW",
      "ECDH-ES+A128GCMKW",
      "ECDH-ES+A192GCMKW",
      "ECDH-ES+A256GCMKW",
    ]) {
      expect(isEcdhEsAlgorithm(algorithm)).toBe(true);
    }
  });

  test("rejects every other key management", () => {
    for (const algorithm of [
      "dir",
      "A256KW",
      "A256GCMKW",
      "RSA-OAEP",
      "PBES2-HS512+A256KW",
    ]) {
      expect(isEcdhEsAlgorithm(algorithm)).toBe(false);
    }
  });
});
