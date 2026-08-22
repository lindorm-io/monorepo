import { B64 } from "@lindorm/b64";
import { KryptosKit } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { B64U } from "../constants/format.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { AegisError } from "../../errors/index.js";
import { COSE_CNF_LABELS } from "../claims/cnf-members.js";
import { coseByJose } from "../header/header-registry.js";
import { encodeCbor, Tag } from "./cbor.js";
import { coseKeyToJwk, decodeCnf, encodeCnf, jwkToCoseKey } from "./cose-key.js";
import { decodeCwtWire } from "./decode-cwt-wire.js";
import { COSE_TAG, encodeProtectedHeader } from "./structures.js";

// COSE_Key labels: RFC 9052 §7, and RFC 9964 §3 for AKP (kty 7).
const KTY = 1;
const AKP_PUB = -1;
const AKP_PRIV = -2;
const AKP_KTY = 7;
// RFC 8747 §3.1
const CNF_LABEL = 8;
const ML_DSA_SEED_SIZE = 32;

describe("AKP COSE_Key (RFC 9964)", () => {
  test("a private ML-DSA JWK maps to kty 7 with pub@-1 and the seed at priv@-2", () => {
    const jwk = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-65" }).toJWK("private");

    const key = jwkToCoseKey(jwk as Dict);

    expect(key.get(KTY)).toBe(AKP_KTY);

    const pub = key.get(AKP_PUB);
    expect(pub).toBeInstanceOf(Buffer);
    expect((pub as Buffer).equals(B64.toBuffer(jwk.pub as string, B64U))).toBe(true);

    const priv = key.get(AKP_PRIV);
    expect(priv).toBeInstanceOf(Buffer);
    expect((priv as Buffer).length).toBe(ML_DSA_SEED_SIZE);
    expect((priv as Buffer).equals(B64.toBuffer(jwk.priv as string, B64U))).toBe(true);
  });

  test("a public-only ML-DSA JWK omits the priv label", () => {
    const jwk = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-44" }).toJWK("public");

    const key = jwkToCoseKey(jwk as Dict);

    expect(key.get(KTY)).toBe(AKP_KTY);
    expect(key.has(AKP_PUB)).toBe(true);
    expect(key.has(AKP_PRIV)).toBe(false);
  });

  test("round-trips a private ML-DSA key jwk -> COSE_Key -> jwk", () => {
    const jwk = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-87" }).toJWK("private");

    const back = coseKeyToJwk(jwkToCoseKey(jwk as Dict));

    expect(back.kty).toBe("AKP");
    expect(back.pub).toBe(jwk.pub);
    expect(back.priv).toBe(jwk.priv);
  });

  test("round-trips a public-only ML-DSA key with no priv", () => {
    const jwk = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-65" }).toJWK("public");

    const back = coseKeyToJwk(jwkToCoseKey(jwk as Dict));

    expect(back.kty).toBe("AKP");
    expect(back.pub).toBe(jwk.pub);
    expect(back.priv).toBeUndefined();
  });

  test("rejects an AKP JWK with no pub", () => {
    expect(() => jwkToCoseKey({ kty: "AKP" })).toThrow(
      expect.objectContaining({ code: "cose_key_unsupported" }),
    );
  });
});

const CNF_JWK: Dict = { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: "eXNhbXBsZQ" };

const thrownBy = (fn: () => unknown): AegisError => {
  try {
    fn();
  } catch (error) {
    return error as AegisError;
  }

  throw new Error("the call was expected to refuse and did not");
};

/**
 * The MIXED confirmation — the case the per-member refusal exists for. With more
 * than one member the output map stays non-empty, so the emptiness refusal never
 * fires and the token ships asserting a binding NARROWER than its author wrote.
 */
describe("encodeCnf, on a confirmation with more than one member", () => {
  test("writes EVERY member it was given, under its own label", () => {
    const out = encodeCnf({ jwk: CNF_JWK, kid: "key_probe" });

    expect(out.size).toBe(2);
    expect(out.get(COSE_CNF_LABELS.jwk)).toBeInstanceOf(Map);
    expect(out.get(COSE_CNF_LABELS.kid)).toEqual(Buffer.from("key_probe", "utf8"));
  });

  test("REFUSES a malformed member rather than dropping it", () => {
    // Without the per-member refusal: a non-string `kid` produces no entry, the
    // map comes out with the `jwk` alone and non-empty, and the token mints bound
    // by the key and NOT by the key id.
    const error = thrownBy(() => encodeCnf({ jwk: CNF_JWK, kid: 42 }));

    expect(error.code).toBe("cose_cnf_member_invalid");
    expect(error.data).toEqual({ member: "kid" });
  });

  test("REFUSES a malformed embedded key the same way", () => {
    const error = thrownBy(() => encodeCnf({ jwk: "not-a-jwk", kid: "key_probe" }));

    expect(error.code).toBe("cose_cnf_member_invalid");
    expect(error.data).toEqual({ member: "jwk" });
  });

  // ⚠ Every thumbprint form gets a row. `KIT_CAPABILITIES` pins the set
  // literally, derived from the label table, so this file is the only place the
  // refusal is driven behaviourally.
  test.each(["jkt", "x5t#S256", "jku"])(
    "still refuses %s — a member the wire cannot carry at all",
    (member) => {
      const error = thrownBy(() => encodeCnf({ jwk: CNF_JWK, [member]: "probe" }));

      expect(error.code).toBe("cose_cnf_unsupported");
      expect(error.data).toEqual({ members: [member], supported: ["jwk", "kid"] });
    },
  );

  test("round-trips both members back to the JOSE cnf shape", () => {
    const decoded = decodeCnf(encodeCnf({ jwk: CNF_JWK, kid: "key_probe" }));

    expect(decoded).toEqual({ jwk: CNF_JWK, kid: "key_probe" });
  });
});

/**
 * ⚠ WHICH KEYS COUNT — the ways the membership filter and the write loop can
 * disagree about what a caller supplied, each the same silent-drop defect. Only
 * reachable through the standalone kit door: `CwtKit.sign` takes the caller's
 * wire dict verbatim, while the domain path builds its cnf with `omitUndefined`
 * over a fixed member list (`claims/translate.ts`).
 */
describe("encodeCnf, on keys that are not what they look like", () => {
  test("a PROTOTYPE key is unrepresentable, not silently skipped", () => {
    // `"constructor" in { jwk: 1, kid: 3 }` is TRUE, so a filter written with `in`
    // finds it representable and raises nothing; the write loop iterates the
    // table's OWN keys and never writes it; `out.size` is 1 so the emptiness guard
    // is silent too. The member vanishes and the token mints.
    const error = thrownBy(() => encodeCnf({ jwk: CNF_JWK, constructor: "x" }));

    expect(error.code).toBe("cose_cnf_unsupported");
    expect(error.data).toEqual({ members: ["constructor"], supported: ["jwk", "kid"] });
  });

  test("the same, through the real CwtKit.sign door", () => {
    const kryptos = KryptosKit.generate.sig.ec({ algorithm: "ES256" });
    const kit = new CwtKit({ kryptos, logger: createMockLogger() });

    // ⚠ `as never`: the type cannot express a prototype key, and the caller this
    // guards against is one the compiler never saw — a JS consumer or a JSON body.
    const error = thrownBy(() =>
      kit.sign({
        iss: "https://issuer.lindorm.io/",
        cnf: { jwk: CNF_JWK, constructor: "x" } as never,
      }),
    );

    expect(error.code).toBe("cose_cnf_unsupported");
  });

  test("an own key holding `undefined` is ABSENT, and the rest still mints", () => {
    // `undefined` means absent across this package (`omitUndefined` spells it), so
    // `{ jwk: undefined }` is a caller who supplied no key, not a broken one.
    const out = encodeCnf({ jwk: undefined, kid: "key_probe" });

    expect(out.size).toBe(1);
    expect(out.get(COSE_CNF_LABELS.kid)).toEqual(Buffer.from("key_probe", "utf8"));
  });

  test("`null` is NOT absent — it is a value, and a malformed one", () => {
    const error = thrownBy(() => encodeCnf({ jwk: null, kid: "key_probe" }));

    expect(error.code).toBe("cose_cnf_member_invalid");
    expect(error.data).toEqual({ member: "jwk" });
  });

  test("an INHERITED member is not written — the two lookups agree", () => {
    // The mirror of the prototype hole on the filter side: `Reflect.ownKeys` never
    // flags an inherited `kid`, so a write loop reading it off the prototype would
    // carry a member the caller never set.
    const error = thrownBy(() => encodeCnf(Object.create({ kid: "inherited" })));

    expect(error.code).toBe("cose_cnf_unsupported");
  });

  test("a NON-ENUMERABLE own member is unrepresentable, not silently skipped", () => {
    // Why the filter reads `Reflect.ownKeys` and not `Object.keys`: a
    // non-enumerable own property is invisible to `Object.keys`, and the write
    // loop iterates the LABEL TABLE's keys, so neither side sees it. Beside a
    // valid `kid` the map is non-empty and the binding ships dropped.
    const bag: Dict = { kid: "key_probe" };
    Object.defineProperty(bag, "jkt", { value: "jkt_probe" });

    const error = thrownBy(() => encodeCnf(bag));

    expect(error.code).toBe("cose_cnf_unsupported");
    expect(error.data).toEqual({ members: ["jkt"], supported: ["jwk", "kid"] });
  });

  test("`undefined` is absent for an UNREPRESENTABLE member too", () => {
    // `undefined` has to mean absent on BOTH sides. A key list reports a key
    // whatever it holds, so a filter reading presence alone makes one `undefined`
    // mean "absent" for `jwk`/`kid` and "present and unrepresentable" for the
    // thumbprint forms — and `{ jkt: claim.thumbprint }` with no thumbprint
    // supplied nothing to fail closed over.
    const out = encodeCnf({ jkt: undefined, kid: "key_probe" });

    expect(out.size).toBe(1);
    expect(out.get(COSE_CNF_LABELS.kid)).toEqual(Buffer.from("key_probe", "utf8"));
  });

  test("but a PRESENT unrepresentable member still fails the map closed", () => {
    const error = thrownBy(() => encodeCnf({ jkt: "jkt_probe", kid: "key_probe" }));

    expect(error.code).toBe("cose_cnf_unsupported");
    expect(error.data).toEqual({ members: ["jkt"], supported: ["jwk", "kid"] });
  });

  test("an all-undefined confirmation is still the emptiness refusal", () => {
    const error = thrownBy(() => encodeCnf({ jwk: undefined, kid: undefined }));

    expect(error.code).toBe("cose_cnf_unsupported");
  });

  test("the surviving member reaches the wire through CwtKit.sign", () => {
    const kryptos = KryptosKit.generate.sig.ec({ algorithm: "ES256" });
    const kit = new CwtKit({ kryptos, logger: createMockLogger() });

    const token = kit.sign({
      iss: "https://issuer.lindorm.io/",
      cnf: { jwk: undefined, kid: "key_probe" } as never,
    });

    expect(decodeCwtWire(token).payload.cnf).toEqual({ kid: "key_probe" });
  });
});

/**
 * A COSE_Key reaches this codec from a FOREIGN token — `decodeCnf` runs on every
 * CWT carrying a `cnf` embedded key — so every label is a stranger's. The tables
 * are plain objects, and `COSE_TO_CRV["constructor"]` is the `Object` function,
 * not `undefined`, so an `=== undefined` guard never fires. `own-entry.ts` is the
 * answer; these rows are what makes it load-bearing.
 */
describe("COSE_Key labels that name an Object.prototype member", () => {
  const PROTO_KEYS = ["constructor", "toString", "valueOf", "hasOwnProperty"] as const;

  test.each(PROTO_KEYS)("a `%s` curve label is REFUSED, not resolved", (name) => {
    const key = new Map<number, unknown>([
      [KTY, 2], // EC2
      [-1, name],
      [-2, Buffer.from("x", "utf8")],
      [-3, Buffer.from("y", "utf8")],
    ]);

    expect(thrownBy(() => coseKeyToJwk(key)).code).toBe("cose_key_unsupported");
  });

  test.each(PROTO_KEYS)("a `%s` kty label is REFUSED too", (name) => {
    expect(
      thrownBy(() => coseKeyToJwk(new Map<number, unknown>([[KTY, name]]))).code,
    ).toBe("cose_key_unsupported");
  });

  // The WRITE twin: the JWK is the caller's bag, so unguarded, a live function
  // becomes the COSE curve label and reaches the CBOR encoder.
  test.each(PROTO_KEYS)(
    "a caller JWK whose crv is `%s` is refused at the write",
    (name) => {
      expect(
        thrownBy(() => jwkToCoseKey({ kty: "EC", crv: name, x: "eA", y: "eQ" })).code,
      ).toBe("cose_key_unsupported");
    },
  );

  test.each(PROTO_KEYS)(
    "a caller JWK whose kty is `%s` is refused at the write",
    (name) => {
      expect(thrownBy(() => jwkToCoseKey({ kty: name })).code).toBe(
        "cose_key_unsupported",
      );
    },
  );

  /**
   * Through a REAL read door: `CwtKit.decode` needs no key, so a stranger's CWT
   * reaches this codec on the keyless read as readily as on verify. Unguarded,
   * this token's `confirmation.key.crv` is the `Object` constructor.
   */
  test("a foreign CWT whose cnf key names a prototype curve is refused at decode", () => {
    const protectedHeader = encodeProtectedHeader(
      new Map<number, unknown>([[coseByJose("alg"), -7]]),
    );

    const coseKey = new Map<number, unknown>([
      [KTY, 2],
      [-1, "constructor"],
      [-2, Buffer.from("x", "utf8")],
      [-3, Buffer.from("y", "utf8")],
    ]);

    const token = encodeCbor(
      new Tag(
        COSE_TAG.cwt,
        new Tag(COSE_TAG.sign1, [
          protectedHeader,
          new Map<number, unknown>([[coseByJose("kid"), Buffer.from("k", "utf8")]]),
          // RFC 8747 §3.1 — the embedded COSE_Key sits under member label 1
          // inside the cnf map, not in its place.
          encodeCbor(
            new Map<number, unknown>([
              [CNF_LABEL, new Map<number, unknown>([[COSE_CNF_LABELS.jwk, coseKey]])],
            ]),
          ),
          Buffer.alloc(8),
        ]),
      ),
    );

    expect(thrownBy(() => decodeCwtWire(token)).code).toBe("cose_key_unsupported");
  });
});

/**
 * The structural refusals the KEYLESS door owes. `CwtKit.decode` takes no key and
 * checks no signature, so every byte reaching this codec through it is a
 * stranger's, and `decode-cwt-wire.ts` sets the standard: a structure this reader
 * cannot use is refused with a `CoseError`, never left to throw a raw `TypeError`
 * no caller can catch as an `AegisError`.
 */
describe("a foreign CWT whose cnf is structurally unusable", () => {
  const foreignCwt = (claims: Map<number | string, unknown>): Buffer =>
    Buffer.from(
      encodeCbor(
        new Tag(
          COSE_TAG.cwt,
          new Tag(COSE_TAG.sign1, [
            encodeProtectedHeader(new Map<number, unknown>([[coseByJose("alg"), -7]])),
            new Map<number, unknown>([[coseByJose("kid"), Buffer.from("k", "utf8")]]),
            encodeCbor(claims),
            Buffer.alloc(8),
          ]),
        ),
      ),
    );

  const withCoseKey = (key: Map<number, unknown>): Buffer =>
    foreignCwt(
      new Map<number | string, unknown>([
        [CNF_LABEL, new Map<number, unknown>([[COSE_CNF_LABELS.jwk, key]])],
      ]),
    );

  const EC2_KTY = 2;
  const OKP_KTY = 1;
  const P256 = 1;
  const ED25519 = 6;

  test.each([
    [
      "an EC2 key with no x",
      new Map<number, unknown>([
        [KTY, EC2_KTY],
        [-1, P256],
        [-3, Buffer.from("y", "utf8")],
      ]),
    ],
    [
      "an EC2 key with no y",
      new Map<number, unknown>([
        [KTY, EC2_KTY],
        [-1, P256],
        [-2, Buffer.from("x", "utf8")],
      ]),
    ],
    [
      "an EC2 key whose x is an integer",
      new Map<number, unknown>([
        [KTY, EC2_KTY],
        [-1, P256],
        [-2, 42],
        [-3, Buffer.from("y", "utf8")],
      ]),
    ],
    [
      "an EC2 key whose y is a text string",
      new Map<number, unknown>([
        [KTY, EC2_KTY],
        [-1, P256],
        [-2, Buffer.from("x", "utf8")],
        [-3, "not-a-bstr"],
      ]),
    ],
    [
      "an OKP key with no x",
      new Map<number, unknown>([
        [KTY, OKP_KTY],
        [-1, ED25519],
      ]),
    ],
  ])("%s is refused as a CoseError at the keyless decode", (_name, key) => {
    const error = thrownBy(() => CwtKit.decode(withCoseKey(key)));

    expect(error).toBeInstanceOf(AegisError);
    expect(error.code).toBe("cose_key_unsupported");
  });

  // RFC 8747 §3.1. Anything else reaches `cnf.get(...)` on a non-Map.
  test.each([
    ["an integer", 42],
    ["a text string", "not-a-map"],
    ["an array", [1, 2]],
    ["a byte string", Buffer.from("cnf", "utf8")],
    ["a text-keyed map", new Map<string, unknown>([["kid", "key_probe"]])],
  ])("a cnf claim that is %s is refused as a CoseError", (_name, cnf) => {
    const error = thrownBy(() =>
      CwtKit.decode(foreignCwt(new Map<number | string, unknown>([[CNF_LABEL, cnf]]))),
    );

    expect(error).toBeInstanceOf(AegisError);
    expect(error.code).toBe("cose_cnf_unsupported");
  });

  // The WRITE twin, on the same members: `cnf.jwk` is the CALLER's bag, and a JWK
  // missing its coordinates is as easy to hand in as to receive.
  test.each([
    ["x", { kty: "EC", crv: "P-256", y: "eQ" }],
    ["y", { kty: "EC", crv: "P-256", x: "eA" }],
    ["x on OKP", { kty: "OKP", crv: "Ed25519" }],
  ])("a caller JWK missing %s is refused at the write", (_name, jwk) => {
    expect(thrownBy(() => jwkToCoseKey(jwk)).code).toBe("cose_key_unsupported");
  });
});
