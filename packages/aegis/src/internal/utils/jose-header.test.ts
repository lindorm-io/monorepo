import { B64 } from "@lindorm/b64";
import { describe, expect, test } from "vitest";
import { JoseError } from "../../errors/index.js";
import { buildJoseHeader } from "../header/build-jose-header.js";
import { KIT_CAPABILITIES } from "../registry/kit-capabilities.js";
import { decodeJoseHeader, encodeJoseHeader } from "./jose-header.js";

const encode = (obj: Record<string, unknown>): string =>
  B64.encode(JSON.stringify(obj), "base64url");

describe("decodeJoseHeader", () => {
  describe("algorithm allowlist", () => {
    test("accepts ES512 (kryptos-supported)", () => {
      const header = encode({ alg: "ES512", typ: "JWT" });
      expect(() => decodeJoseHeader(header)).not.toThrow();
    });

    test("accepts RSA-OAEP-256 (kryptos-supported)", () => {
      const header = encode({ alg: "RSA-OAEP-256", enc: "A256GCM" });
      expect(() => decodeJoseHeader(header)).not.toThrow();
    });

    test("rejects alg: none (not in kryptos allowlist)", () => {
      const header = encode({ alg: "none", typ: "JWT" });
      expect(() => decodeJoseHeader(header)).toThrow("Unsupported algorithm: none");
    });

    test("rejects alg: RSA1_5 (Bleichenbacher-vulnerable, kryptos does not support it)", () => {
      const header = encode({ alg: "RSA1_5", enc: "A256GCM" });
      expect(() => decodeJoseHeader(header)).toThrow("Unsupported algorithm: RSA1_5");
    });

    test("rejects alg: HS1 (weak HMAC, not in kryptos allowlist)", () => {
      const header = encode({ alg: "HS1", typ: "JWT" });
      expect(() => decodeJoseHeader(header)).toThrow("Unsupported algorithm: HS1");
    });

    test("rejects entirely fabricated algorithm names", () => {
      const header = encode({ alg: "TotallyMadeUp", typ: "JWT" });
      expect(() => decodeJoseHeader(header)).toThrow(
        "Unsupported algorithm: TotallyMadeUp",
      );
    });
  });

  describe("alg presence", () => {
    test("rejects missing alg", () => {
      const header = encode({ typ: "JWT" });
      expect(() => decodeJoseHeader(header)).toThrow(
        "Missing or invalid token header: alg",
      );
    });

    test("rejects non-string alg", () => {
      const header = encode({ alg: 42, typ: "JWT" });
      expect(() => decodeJoseHeader(header)).toThrow(
        "Missing or invalid token header: alg",
      );
    });
  });

  describe("typ validation", () => {
    test("accepts missing typ (optional per RFC 7515 §4.1.9)", () => {
      const header = encode({ alg: "ES512" });
      expect(() => decodeJoseHeader(header)).not.toThrow();
    });

    test("rejects non-string typ", () => {
      const header = encode({ alg: "ES512", typ: 42 });
      expect(() => decodeJoseHeader(header)).toThrow(
        "Invalid token header: typ must be a string",
      );
    });
  });
});

/**
 * ⚠ `@ts-expect-error` IS THE ASSERTION, and it only bites under `tsc`: vitest
 * strips types without checking them, so the pin is proved by `npm run typecheck`.
 * A directive that stops being needed fails it as an UNUSED `@ts-expect-error`.
 *
 * ⚠ THE BUILT HEADER BESIDE THE REFUSAL is what stops the row passing for the wrong
 * reason: an `@ts-expect-error` is satisfied by ANY error on the line, and the
 * literal under it is a valid `WireTokenHeaderOptions` in every other respect.
 */
describe("encodeJoseHeader", () => {
  test("takes only a header buildJoseHeader assembled", () => {
    const built = buildJoseHeader({
      reserved: KIT_CAPABILITIES.jws.reserved,
      defaults: {},
      header: undefined,
      custom: undefined,
      derived: { alg: "ES512", kid: "key_test", typ: "JWT" },
      cert: undefined,
      format: "jws",
      error: JoseError,
    });

    // @ts-expect-error a header no builder assembled is not a built header
    const handBuilt = encodeJoseHeader({ alg: "ES512", kid: "key_test", typ: "JWT" });

    expect(handBuilt).toBe(encodeJoseHeader(built));
  });
});
