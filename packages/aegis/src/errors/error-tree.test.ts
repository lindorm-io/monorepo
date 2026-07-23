import { LindormError } from "@lindorm/errors";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG } from "../__fixtures__/keys.js";
import { CwmKit } from "../classes/CwmKit.js";
import { CwtKit } from "../classes/CwtKit.js";
import { resolveCertBinding } from "../internal/utils/resolve-cert-binding.js";
import { verifyToken } from "../internal/utils/verify-token.js";
import {
  AegisDomainError,
  AegisError,
  AegisKeyError,
  CoseError,
  CweError,
  CwmError,
  CwsError,
  CwtError,
  JoseError,
  JweError,
  JwsError,
  JwtError,
} from "./index.js";

/**
 * Bit 10 — the aegis error tree. `LindormError ⊃ AegisError ⊃ family ⊃ leaf`,
 * with two policy siblings (`AegisKeyError` / `AegisDomainError`). The tree is
 * ADDITIVE: `instanceof AegisError` must still catch every aegis error. These
 * tests assert the graduated catch (each leaf grades all the way up, and is NOT
 * caught by the sibling family) and that the routed throw-sites + new codes land
 * on the right class.
 */
describe("aegis error tree (Bit 10)", () => {
  const joseLeaves = [
    ["JwtError", JwtError],
    ["JwsError", JwsError],
    ["JweError", JweError],
  ] as const;

  const coseLeaves = [
    ["CwtError", CwtError],
    ["CwmError", CwmError],
    ["CwsError", CwsError],
    ["CweError", CweError],
  ] as const;

  test.each(joseLeaves)("%s grades JoseError, never CoseError", (_name, Leaf) => {
    const error = new Leaf("boom", { code: "x" });
    expect(error).toBeInstanceOf(Leaf);
    expect(error).toBeInstanceOf(JoseError);
    expect(error).toBeInstanceOf(AegisError);
    expect(error).toBeInstanceOf(LindormError);
    expect(error).not.toBeInstanceOf(CoseError);
    expect(error).not.toBeInstanceOf(AegisKeyError);
    expect(error).not.toBeInstanceOf(AegisDomainError);
  });

  test.each(coseLeaves)("%s grades CoseError, never JoseError", (_name, Leaf) => {
    const error = new Leaf("boom", { code: "x" });
    expect(error).toBeInstanceOf(Leaf);
    expect(error).toBeInstanceOf(CoseError);
    expect(error).toBeInstanceOf(AegisError);
    expect(error).toBeInstanceOf(LindormError);
    expect(error).not.toBeInstanceOf(JoseError);
    expect(error).not.toBeInstanceOf(AegisKeyError);
    expect(error).not.toBeInstanceOf(AegisDomainError);
  });

  test("leaves within a family are mutually exclusive", () => {
    expect(new JwtError("x")).not.toBeInstanceOf(JwsError);
    expect(new JweError("x")).not.toBeInstanceOf(JwtError);
    expect(new CwtError("x")).not.toBeInstanceOf(CwmError);
    expect(new CwsError("x")).not.toBeInstanceOf(CweError);
    expect(new CwmError("x")).not.toBeInstanceOf(CwtError);
  });

  test("AegisKeyError is an AegisError, but neither a format nor a domain error", () => {
    const error = new AegisKeyError("x", { code: "verify_key_not_found" });
    expect(error).toBeInstanceOf(AegisError);
    expect(error).toBeInstanceOf(LindormError);
    expect(error).not.toBeInstanceOf(JoseError);
    expect(error).not.toBeInstanceOf(CoseError);
    expect(error).not.toBeInstanceOf(AegisDomainError);
  });

  test("AegisDomainError is an AegisError, but neither a format nor a key error", () => {
    const error = new AegisDomainError("x", { code: "verify_requires_signature" });
    expect(error).toBeInstanceOf(AegisError);
    expect(error).toBeInstanceOf(LindormError);
    expect(error).not.toBeInstanceOf(JoseError);
    expect(error).not.toBeInstanceOf(CoseError);
    expect(error).not.toBeInstanceOf(AegisKeyError);
  });

  test("instanceof AegisError catches every aegis error class (additive guarantee)", () => {
    const classes = [
      JoseError,
      JwtError,
      JwsError,
      JweError,
      CoseError,
      CwtError,
      CwmError,
      CwsError,
      CweError,
      AegisKeyError,
      AegisDomainError,
    ];
    for (const Cls of classes) {
      expect(new Cls("x")).toBeInstanceOf(AegisError);
    }
  });

  test("a thrown leaf is caught at every level of its chain (graduated catch)", () => {
    const caughtBy = (Cls: typeof LindormError): boolean => {
      try {
        throw new CwtError("boom", { code: "cwt_kid_mismatch" });
      } catch (error) {
        return error instanceof Cls;
      }
    };
    expect(caughtBy(CwtError)).toBe(true);
    expect(caughtBy(CoseError)).toBe(true);
    expect(caughtBy(AegisError)).toBe(true);
    expect(caughtBy(LindormError)).toBe(true);
    expect(caughtBy(JoseError)).toBe(false);
  });
});

describe("aegis error tree — serialised lineage", () => {
  // The instanceof tree is real at the type level, but a logged/serialised error
  // only shows its leaf. `lineage` surfaces the class-ancestry chain (leaf-first,
  // up to and including `LindormError`) so an operator reading logs sees the tree.
  test("a JwtError serialises its full lineage leaf-first", () => {
    expect(new JwtError("boom", { code: "x" }).lineage).toEqual([
      "JwtError",
      "JoseError",
      "AegisError",
      "LindormError",
    ]);
  });

  test("a CwtError serialises its full lineage leaf-first", () => {
    expect(new CwtError("boom", { code: "x" }).lineage).toEqual([
      "CwtError",
      "CoseError",
      "AegisError",
      "LindormError",
    ]);
  });

  test("a policy sibling (AegisKeyError) lineage stops at its family root", () => {
    expect(new AegisKeyError("boom", { code: "x" }).lineage).toEqual([
      "AegisKeyError",
      "AegisError",
      "LindormError",
    ]);
  });

  test("lineage lands in toJSON alongside type/code", () => {
    const json = new JwtError("boom", { code: "x" }).toJSON();
    expect(json.lineage).toEqual(["JwtError", "JoseError", "AegisError", "LindormError"]);
  });

  test("a thrown leaf carries its lineage through a catch", () => {
    try {
      throw new CwtError("boom", { code: "cwt_kid_mismatch" });
    } catch (error) {
      expect((error as CwtError).lineage).toEqual([
        "CwtError",
        "CoseError",
        "AegisError",
        "LindormError",
      ]);
    }
  });
});

describe("aegis error tree — real throw-site routing", () => {
  const logger = createMockLogger();

  // --- kit-structural -> the leaf format class ---

  test("CwtKit rejects a symmetric key as a CwtError (structural leaf)", () => {
    let caught: unknown;
    try {
      new CwtKit({ logger, kryptos: TEST_OCT_KEY_SIG });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CwtError);
    expect(caught).toBeInstanceOf(CoseError);
    expect(caught).toBeInstanceOf(AegisError);
    expect(caught).not.toBeInstanceOf(JoseError);
    expect((caught as CwtError).code).toBe("cwt_requires_asymmetric_key");
  });

  test("CwmKit rejects an asymmetric key as a CwmError (structural leaf)", () => {
    let caught: unknown;
    try {
      new CwmKit({ logger, kryptos: TEST_EC_KEY_SIG });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CwmError);
    expect(caught).toBeInstanceOf(CoseError);
    expect(caught).not.toBeInstanceOf(CwtError);
    expect((caught as CwmError).code).toBe("cwm_requires_symmetric_key");
  });

  // --- <fmt>_kid_mismatch (kid fail-fast) -> the leaf format class ---

  test("CwtKit kid fail-fast surfaces cwt_kid_mismatch on CwtError", () => {
    const signer = new CwtKit({ logger, kryptos: TEST_EC_KEY_SIG });
    const token = signer.sign({ sub: "user-1" }, { tokenType: "at" });

    // A verifier whose configured key has a different id than the token's kid
    // must fail fast, before the signature cycle, with the leaf error.
    const other = KryptosKit.clone(TEST_EC_KEY_SIG, {
      id: "00000000-0000-0000-0000-000000000000",
    });
    const verifier = new CwtKit({ logger, kryptos: other });

    let caught: unknown;
    try {
      verifier.verify(token);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CwtError);
    expect(caught).toBeInstanceOf(CoseError);
    expect(caught).not.toBeInstanceOf(JoseError);
    expect((caught as CwtError).code).toBe("cwt_kid_mismatch");
  });

  // --- key resolution -> AegisKeyError ---

  test("resolveCertBinding without a certificate chain throws an AegisKeyError", () => {
    let caught: unknown;
    try {
      resolveCertBinding(TEST_EC_KEY_SIG, "thumbprint");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AegisKeyError);
    expect(caught).toBeInstanceOf(AegisError);
    expect(caught).not.toBeInstanceOf(AegisDomainError);
    expect((caught as AegisKeyError).code).toBe("cert_binding_chain_required");
  });

  // --- domain policy -> AegisDomainError ---

  test("verify of an unsigned encrypted inner throws verify_requires_signature on AegisDomainError", async () => {
    // Once an encrypting outer has been peeled (`encrypted: true`) an inner that
    // is not a signed token cannot be sender-authenticated -> verify refuses it.
    let caught: unknown;
    try {
      await verifyToken({
        token: "unsigned-plaintext-claims",
        deps: {} as any,
        encrypted: true,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AegisDomainError);
    expect(caught).toBeInstanceOf(AegisError);
    expect((caught as AegisDomainError).code).toBe("verify_requires_signature");
  });

  test("verify of an unrecognised token (no encrypting outer) stays unsupported_token_type", async () => {
    let caught: unknown;
    try {
      await verifyToken({ token: "unsigned-plaintext-claims", deps: {} as any });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AegisError);
    expect(caught).not.toBeInstanceOf(AegisDomainError);
    expect((caught as AegisError).code).toBe("unsupported_token_type");
  });
});
