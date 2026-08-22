import { B64 } from "@lindorm/b64";
import { describe, expect, test } from "vitest";
import {
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_SIG,
} from "../../__fixtures__/keys.js";
import { AegisError } from "../../errors/index.js";
import { B64U } from "../constants/format.js";
import {
  computeCoseKeyThumbprint,
  computeCoseKeyThumbprintUri,
} from "./cose-key-thumbprint.js";

const hexToB64u = (hex: string): string => B64.encode(Buffer.from(hex, "hex"), B64U);

describe("computeCoseKeyThumbprint (RFC 9679)", () => {
  // RFC 9679 §6 worked example.
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: hexToB64u("65eda5a12577c2bae829437fe338701a10aaa375e1bb5b5de108de439c08551d"),
    y: hexToB64u("1e52ed75701163f7f9e40ddf9f341b3dc9ba860af7e0ca7ca7e9eecd0084d19c"),
  };

  test("matches the RFC 9679 §6 test vector", () => {
    expect(computeCoseKeyThumbprint(jwk).toString("hex")).toBe(
      "496bd8afadf307e5b08c64b0421bf9dc01528a344a43bda88fadd1669da253ec",
    );
  });

  test("produces the RFC 9679 §5.7 thumbprint URI", () => {
    expect(computeCoseKeyThumbprintUri(jwk)).toBe(
      "urn:ietf:params:oauth:ckt:sha-256:SWvYr63zB-WwjGSwQhv53AFSijRKQ72oj63RZp2iU-w",
    );
  });

  test("ignores optional members (kid/alg/use) — same key, same thumbprint", () => {
    const base = computeCoseKeyThumbprint(jwk);
    const withExtras = computeCoseKeyThumbprint({
      ...jwk,
      kid: "key-1",
      alg: "ES256",
      use: "sig",
    });
    expect(withExtras.equals(base)).toBe(true);
  });

  test("supports OKP / RSA / oct keys with a stable 32-byte SHA-256 digest", () => {
    for (const kryptos of [TEST_OKP_KEY_SIG, TEST_RSA_KEY_SIG, TEST_OCT_KEY_SIG]) {
      const out = computeCoseKeyThumbprint(kryptos.export("jwk") as never);
      expect(out).toHaveLength(32);
      expect(computeCoseKeyThumbprint(kryptos.export("jwk") as never).equals(out)).toBe(
        true,
      );
    }
  });

  test("rejects a key type RFC 9679 does not define (e.g. AKP)", () => {
    expect(() => computeCoseKeyThumbprint({ kty: "AKP", alg: "ML-DSA-65" })).toThrow(
      AegisError,
    );
  });
});

/**
 * ⚠ THE CURVE LOOKUP IS THE ONE TOKEN-ADJACENT TABLE READ IN THIS FILE, and this
 * is the only thing pinning it. Reverted to `CRV_TO_COSE[jwk.crv]`, a plain-object
 * index answers `Object.prototype.constructor` with a live FUNCTION rather than
 * `undefined`, the `=== undefined` guard never fires, and the function reaches
 * `encodeCbor` as a curve label — a `ckt` for a key that does not exist. See
 * own-entry.ts.
 *
 * The JWK is a CALLER's: `computeCoseKeyThumbprintUri` is how a deployment turns a
 * peer's advertised key into a `ckt` binding, so `crv` is as external as a curve
 * label off a foreign token.
 */
describe("a curve name the table does not own", () => {
  const PROTO_KEYS = ["constructor", "toString", "valueOf", "hasOwnProperty"] as const;

  const thrownBy = (fn: () => unknown): AegisError => {
    try {
      fn();
    } catch (error) {
      return error as AegisError;
    }

    throw new Error("the call was expected to refuse and did not");
  };

  test.each([...PROTO_KEYS, "P-999", ""])(
    "an EC key whose crv is `%s` is refused rather than labelled",
    (crv) => {
      const error = thrownBy(() =>
        computeCoseKeyThumbprint({ kty: "EC", crv, x: "eA", y: "eQ" }),
      );

      expect(error).toBeInstanceOf(AegisError);
      expect(error.code).toBe("cose_key_unsupported");
      expect(error.data).toEqual({ crv });
    },
  );

  test.each([...PROTO_KEYS, "P-999"])(
    "an OKP key whose crv is `%s` is refused through the URI door too",
    (crv) => {
      const error = thrownBy(() =>
        computeCoseKeyThumbprintUri({ kty: "OKP", crv, x: "eA" }),
      );

      expect(error.code).toBe("cose_key_unsupported");
      expect(error.data).toEqual({ crv });
    },
  );
});
