import { B64 } from "@lindorm/b64";
import { KryptosKit } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { B64U } from "../constants/format.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { AegisError } from "../../errors/index.js";
import { COSE_CNF_LABELS } from "../registry/cose-cnf-labels.js";
import { coseKeyToJwk, decodeCnf, encodeCnf, jwkToCoseKey } from "./cose-key.js";
import { decodeCwtWire } from "./decode-cwt-wire.js";

// COSE_Key labels (RFC 9052 §7 + RFC 9964 §5): kty = 1, and for AKP (kty 7) the
// raw public key `pub` = -1 and the 32-byte seed `priv` = -2, both bstr.
const KTY = 1;
const AKP_PUB = -1;
const AKP_PRIV = -2;
const AKP_KTY = 7;
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
 * The MIXED confirmation — the case the per-member refusal exists for.
 *
 * A confirmation carrying more than one member is where a silent drop does real
 * damage: the output map is non-empty, so the emptiness refusal never fires, and
 * the token ships asserting a binding NARROWER than its author wrote. A verifier
 * then checks the binding it can see, is satisfied, and stops asking about the
 * one that vanished.
 */
describe("encodeCnf, on a confirmation with more than one member", () => {
  test("writes EVERY member it was given, under its own label", () => {
    const out = encodeCnf({ jwk: CNF_JWK, kid: "key_probe" });

    expect(out.size).toBe(2);
    expect(out.get(COSE_CNF_LABELS.jwk)).toBeInstanceOf(Map);
    expect(out.get(COSE_CNF_LABELS.kid)).toEqual(Buffer.from("key_probe", "utf8"));
  });

  test("REFUSES a malformed member rather than dropping it", () => {
    // The silent drop this closed: `kid` is not a string, so it produced no
    // entry, the map came out with the `jwk` alone and non-empty, and the
    // emptiness refusal never fired. The token minted bound by the key and NOT
    // by the key id.
    const error = thrownBy(() => encodeCnf({ jwk: CNF_JWK, kid: 42 }));

    expect(error.code).toBe("cose_cnf_member_invalid");
    expect(error.data).toEqual({ member: "kid" });
  });

  test("REFUSES a malformed embedded key the same way", () => {
    const error = thrownBy(() => encodeCnf({ jwk: "not-a-jwk", kid: "key_probe" }));

    expect(error.code).toBe("cose_cnf_member_invalid");
    expect(error.data).toEqual({ member: "jwk" });
  });

  // ⚠ ALL THREE thumbprint forms, one row each. `KIT_CAPABILITIES`'s own probe
  // used to mint each JOSE cnf member alone and collect what survived, which
  // covered `x5t#S256` and `jku` behaviourally; that probe became circular once
  // the capability row was derived from the label table and was replaced by a
  // literal pin. This is where the behavioural half lives now — without it,
  // `jkt` was the only unrepresentable member any test actually drove.
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
 * ⚠ WHICH KEYS COUNT — the two ways the membership filter and the write loop can
 * disagree about what a caller actually supplied. Both are the SAME silent-drop
 * defect the per-member refusal exists to close, and both are reachable only
 * through the STANDALONE kit door: the domain path builds its cnf with
 * `omitUndefined` over a fixed member list (`claims/translate.ts`), so neither
 * shape can arise there. `CwtKit.sign` takes the caller's wire dict verbatim.
 */
describe("encodeCnf, on keys that are not what they look like", () => {
  test("a PROTOTYPE key is unrepresentable, not silently skipped", () => {
    // `"constructor" in { jwk: 1, kid: 3 }` is TRUE — `in` walks the prototype
    // chain — so a membership filter written with `in` finds `constructor`
    // "representable" and raises nothing. The write loop then iterates the
    // table's OWN keys, never writes it, and `out.size` is 1, so the emptiness
    // guard is silent too: the member vanishes and the token mints.
    const error = thrownBy(() => encodeCnf({ jwk: CNF_JWK, constructor: "x" }));

    expect(error.code).toBe("cose_cnf_unsupported");
    expect(error.data).toEqual({ members: ["constructor"], supported: ["jwk", "kid"] });
  });

  test("the same, through the real CwtKit.sign door", () => {
    const kryptos = KryptosKit.generate.sig.ec({ algorithm: "ES256" });
    const kit = new CwtKit({ kryptos, logger: createMockLogger() });

    // ⚠ `as never` on purpose — the same idiom the capability probes use. The
    // type cannot express a prototype key, and the caller this guards against is
    // exactly the one the compiler never saw: a JS consumer or a JSON body.
    const error = thrownBy(() =>
      kit.sign({
        iss: "https://issuer.lindorm.io/",
        cnf: { jwk: CNF_JWK, constructor: "x" } as never,
      }),
    );

    expect(error.code).toBe("cose_cnf_unsupported");
  });

  test("an own key holding `undefined` is ABSENT, and the rest still mints", () => {
    // `undefined` means absent across this package — `omitUndefined` is how the
    // domain layer spells it — so `{ jwk: undefined }` is a caller who supplied
    // no key, not one who supplied a broken one. Refusing it would reject a
    // confirmation the wire can carry perfectly well.
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
    // The mirror of the prototype hole closed on the filter side. The filter uses
    // `Reflect.ownKeys` (OWN keys only), so an inherited `kid` is never flagged
    // unrepresentable; if the write loop then read it off the prototype, the two
    // lookups would disagree and the map would carry a member the caller never
    // set on the object. It fails closed rather than writing more.
    const error = thrownBy(() => encodeCnf(Object.create({ kid: "inherited" })));

    expect(error.code).toBe("cose_cnf_unsupported");
  });

  test("a NON-ENUMERABLE own member is unrepresentable, not silently skipped", () => {
    // The third way a key can hide, and the reason the filter reads
    // `Reflect.ownKeys` rather than `Object.keys`: an own property defined
    // without `enumerable` is invisible to `Object.keys`, so it was never
    // flagged unrepresentable, and the write loop iterates the LABEL TABLE's
    // keys so it never wrote it either. Beside a valid `kid` the map comes out
    // non-empty, the emptiness guard stays quiet, and the binding ships dropped
    // — the same silent-drop class as the prototype and mixed-member cases.
    const bag: Dict = { kid: "key_probe" };
    Object.defineProperty(bag, "jkt", { value: "jkt_probe" });

    const error = thrownBy(() => encodeCnf(bag));

    expect(error.code).toBe("cose_cnf_unsupported");
    expect(error.data).toEqual({ members: ["jkt"], supported: ["jwk", "kid"] });
  });

  test("`undefined` is absent for an UNREPRESENTABLE member too", () => {
    // The doctrine has to hold on BOTH sides of the function or it is not a
    // doctrine. The write loop skipped an own key holding `undefined`; the
    // filter above it did not, because a key list reports the key regardless of
    // its value — so the same `undefined` meant "absent" for `jwk`/`kid` and
    // "present and unrepresentable" for `jkt`/`x5t#S256`/`jku`. A caller
    // assembling `{ jkt: claim.thumbprint, kid: claim.keyId }` with no
    // thumbprint supplied NOTHING; there is no member to fail closed over.
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
