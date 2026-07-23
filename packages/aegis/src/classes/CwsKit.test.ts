import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { AegisError } from "../errors/index.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { COSE_TAG, decodeProtectedHeader } from "../internal/cose/structures.js";
import { CwsKit } from "./CwsKit.js";

// The sole opaque COSE signer: it produces a COSE_Sign1 (tag 18) for an
// asymmetric key and a COSE_Mac0 (tag 17) for a symmetric one, gating on the
// key's `algClass` itself.
describe("CwsKit — asymmetric key produces a COSE_Sign1 (tag 18)", () => {
  const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });

  test("round-trips a payload through sign -> CBOR -> verify", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const bytes = kit.sign(payload, { tokenType: "at" });
    const sign1 = decodeCbor<Tag>(bytes);
    expect(sign1.tag).toBe(COSE_TAG.sign1);

    const { payload: out } = kit.verify(bytes);
    expect(out.equals(payload)).toBe(true);
  });

  test("rejects a tampered payload", () => {
    const sign1 = decodeCbor<Tag>(kit.sign(Buffer.from("authentic")));
    const arr = sign1.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[3]); // the signature
    tampered[0] ^= 0xff;
    arr[3] = tampered;

    expect(() => kit.verify(encodeCbor(sign1))).toThrow(AegisError);
  });
});

describe("CwsKit — symmetric key produces a COSE_Mac0 (tag 17)", () => {
  const kryptos = KryptosKit.generate.sig.oct({ algorithm: "HS256" });
  const kit = new CwsKit({ kryptos, logger: createMockLogger() });

  test("round-trips a payload through mac -> CBOR -> verify", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const bytes = kit.sign(payload, { tokenType: "at" });
    const mac0 = decodeCbor<Tag>(bytes);
    expect(mac0.tag).toBe(COSE_TAG.mac0);

    const { payload: out, header } = kit.verify(bytes);
    expect(out.equals(payload)).toBe(true);
    expect(header.alg).toBe("HS256"); // HS256 wire alg name
  });

  test("rejects a tampered payload", () => {
    const mac0 = decodeCbor<Tag>(kit.sign(Buffer.from("authentic")));
    const arr = mac0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]); // the payload
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    expect(() => kit.verify(encodeCbor(mac0))).toThrow(AegisError);
  });
});

describe("CwsKit — caller-controlled protected / unprotected header bags", () => {
  const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });
  const x5u = "https://certs.lindorm.io/leaf.pem";

  const rawMaps = (token: Buffer) => {
    const sign1 = decodeCbor<Tag>(token);
    const [protectedBstr, unprotected] = sign1.contents as [Buffer, Map<number, unknown>];
    return { protectedMap: decodeProtectedHeader(protectedBstr), unprotected };
  };

  test("places header params protected and unprotected params unprotected", () => {
    const token = kit.sign(Buffer.from("claims"), {
      header: { cty: "application/example" },
      unprotected: { x5u },
    });

    // Merged wire view surfaces both, plus the always-present derived params.
    const { header } = kit.verify(token);
    expect(header.cty).toBe("application/example");
    expect(header.x5u).toBe(x5u);
    expect(header.alg).toBe("ES512");
    expect(header.kid).toBe(TEST_EC_KEY_SIG.id);

    // The raw CBOR maps prove the placement: cty (label 3) + alg (1) protected;
    // x5u (35) + kid (4) unprotected.
    const { protectedMap, unprotected } = rawMaps(token);
    expect(protectedMap.has(coseByJose("cty"))).toBe(true);
    expect(protectedMap.has(coseByJose("alg"))).toBe(true);
    expect(protectedMap.has(coseByJose("x5u"))).toBe(false);
    expect(unprotected.has(coseByJose("x5u"))).toBe(true);
    expect(unprotected.has(coseByJose("kid"))).toBe(true);
    expect(unprotected.has(coseByJose("cty"))).toBe(false);
  });

  test("tokenType builds the protected typ media type (label 16)", () => {
    const token = kit.sign(Buffer.from("claims"), { tokenType: "at" });
    const { protectedMap } = rawMaps(token);
    expect(protectedMap.get(coseByJose("typ"))).toBe("application/at+cws");
  });

  const codeOf = (fn: () => unknown): string | number | null | undefined => {
    try {
      fn();
    } catch (err) {
      return (err as AegisError).code;
    }
    return undefined;
  };

  test("throws when a derived param (alg) is smuggled into header via an untyped bag", () => {
    expect(
      codeOf(() =>
        kit.sign(Buffer.from("claims"), { header: { alg: "ES256" } as never }),
      ),
    ).toBe("cose_reserved_header");
  });

  test("throws when a derived param (kid) is smuggled into the unprotected bag", () => {
    expect(
      codeOf(() =>
        kit.sign(Buffer.from("claims"), { unprotected: { kid: "other" } as never }),
      ),
    ).toBe("cose_reserved_header");
  });

  test("throws when a crit-listed param is placed unprotected", () => {
    expect(
      codeOf(() =>
        kit.sign(Buffer.from("claims"), {
          header: { crit: ["cty"] },
          unprotected: { cty: "application/example" },
        }),
      ),
    ).toBe("cose_crit_param_unprotected");
  });

  test("throws when crit itself is placed unprotected", () => {
    expect(
      codeOf(() =>
        kit.sign(Buffer.from("claims"), { unprotected: { crit: ["cty"] } as never }),
      ),
    ).toBe("cose_crit_unprotected");
  });

  test("throws when the same param is set in both bags", () => {
    expect(
      codeOf(() =>
        kit.sign(Buffer.from("claims"), {
          header: { cty: "a" },
          unprotected: { cty: "b" },
        }),
      ),
    ).toBe("cose_duplicate_header");
  });
});

describe("CwsKit — proprietary alg gate (D5)", () => {
  // ML-DSA (post-quantum, AKP) is a reachable kryptos signing algorithm with NO
  // official COSE registration — private-use. Non-proprietary sign refuses it;
  // proprietary allows it, and verify is always lenient.
  const kryptos = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-44" });
  const kit = new CwsKit({ kryptos, logger: createMockLogger() });

  test("non-proprietary sign refuses ML-DSA (no official COSE label)", () => {
    const error = (() => {
      try {
        kit.sign(Buffer.from("the cwt claims bytes"));
      } catch (err) {
        return err as AegisError;
      }
    })();

    expect(error).toBeInstanceOf(AegisError);
    expect(error?.code).toBe("cose_alg_not_registered");
  });

  test("proprietary sign allows ML-DSA and round-trips through verify", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const bytes = kit.sign(payload, { proprietary: true });
    const sign1 = decodeCbor<Tag>(bytes);
    expect(sign1.tag).toBe(COSE_TAG.sign1);
    // The private-use ML-DSA alg label sits below the COSE private-use floor.
    const protectedHeader = decodeCbor<Map<number, unknown>>(
      (sign1.contents as Array<Buffer>)[0],
    );
    expect(protectedHeader.get(1)).toBeLessThan(-65536);

    // Verify is ALWAYS lenient — it reads the private-use label back with no flag.
    const { payload: out } = kit.verify(bytes);
    expect(out.equals(payload)).toBe(true);
  });
});
