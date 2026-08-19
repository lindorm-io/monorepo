import { isArray, isBuffer, isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import { describe, expect, test } from "vitest";
import type { DomainTokenHeader, WireTokenHeader } from "../../types/index.js";
import type { HeaderCodec } from "../registry/header-spec.js";
import { WIRE_TAGS } from "../registry/wire.js";
import { isPrivateUseLabel } from "../registry/is-private-use-label.js";
import {
  coseByJose,
  coseWireKey,
  HEADER_SPECS,
  headerByCose,
  headerByDomain,
  headerByJose,
  headerCoseLabel,
  headerJoseName,
  joseByCose,
} from "./header-registry.js";

// Witness whose keys ARE the DOMAIN fields of DomainTokenHeader — every field
// EXCEPT the two that have no wire parameter: `baseFormat` (DERIVED from `typ`)
// and `tokenType` (set by the kit after parsing). Typed as a `Record<..., true>`,
// so adding OR removing a DomainTokenHeader field forces this witness to change
// (compile error), which then forces the registry to change (the runtime checks
// below). This is the both-directions type binding.
const PARSED_DOMAIN_FIELDS: Record<
  Exclude<keyof DomainTokenHeader, "baseFormat" | "tokenType">,
  true
> = {
  algorithm: true,
  certificateChain: true,
  certificateThumbprint: true,
  certificateThumbprintSha1: true,
  certificateUrl: true,
  contentType: true,
  critical: true,
  encryption: true,
  headerType: true,
  initialisationVector: true,
  jwk: true,
  jwksUri: true,
  keyId: true,
  objectId: true,
  partyProducer: true,
  partyRecipient: true,
  pbkdfIterations: true,
  pbkdfSalt: true,
  publicEncryptionJwk: true,
  publicEncryptionTag: true,
  zip: true,
};

// Witness whose keys ARE the wire keys of WireTokenHeader (RFC 7515 §4.1). Same
// type-binding trick: a wire rename in WireTokenHeader forces this to change,
// forcing a registry entry to match.
const TOKEN_HEADER_WIRE: Record<keyof WireTokenHeader, true> = {
  alg: true,
  apu: true,
  apv: true,
  crit: true,
  cty: true,
  enc: true,
  epk: true,
  iv: true,
  jku: true,
  jwk: true,
  kid: true,
  oid: true,
  p2c: true,
  p2s: true,
  tag: true,
  typ: true,
  x5c: true,
  x5t: true,
  "x5t#S256": true,
  x5u: true,
  zip: true,
};

/**
 * Does a `sample` carry the shape its codec kind implies? Exhaustive with a
 * `never` default, so a new {@link HeaderCodec} kind cannot be added without
 * stating the shape it samples.
 */
const sampleMatchesCodec = (codec: HeaderCodec, sample: unknown): boolean => {
  switch (codec.kind) {
    case "string":
      return isString(sample);
    case "url":
      // `encodeHeaderValue` guards this kind with `isUrlLike`, so the sample must
      // clear the same bar the encoder applies.
      return isUrlLike(sample);
    case "number":
      return isFinite(sample);
    case "jwk":
      return isObject(sample);
    case "buffer":
      // The raw side carries Buffers; `encodeJoseHeader` base64urls them later.
      return isBuffer(sample);
    case "array":
    case "critical":
      // `crit` members are wire/domain parameter NAMES, so both are string arrays.
      return isArray(sample) && sample.every(isString);
    default: {
      const exhaustive: never = codec;
      throw new Error(`Unhandled header codec kind: ${(exhaustive as HeaderCodec).kind}`);
    }
  }
};

describe("HEADER_SPECS", () => {
  // --- shared ParamSpec base ------------------------------------------------

  // ⚠ A test stood here asserting `HEADER_REGISTRY.unregistered === "drop"` and
  // `HEADER_REGISTRY.specs === HEADER_SPECS` — the literal against itself, and
  // nothing else. The wrapper is deleted with it. What the column CLAIMED is
  // exercised where it actually happens: `token-header.test.ts` requires an
  // unregistered key to be DROPPED on the write pass and on the read pass, and
  // requires the prune never to reach one.

  test("every entry is TOTAL over the wires", () => {
    for (const spec of HEADER_SPECS) {
      for (const wire of WIRE_TAGS) {
        expect(spec.wire[wire], `${spec.domain} has no ${wire} wire key`).toBeDefined();
      }
    }
  });

  test("every COSE-absent parameter states a non-empty REASON", () => {
    // The whole point of the `absent` arm: a drop is a stated fact, not a
    // missing optional field. A new parameter that COSE cannot carry must say
    // WHY, and `coseByJose` reports that reason when it refuses.
    const absent = HEADER_SPECS.filter((spec) => spec.wire.cose.kind === "absent");

    expect(absent.map(headerJoseName).sort()).toEqual([
      "apu",
      "apv",
      "enc",
      "epk",
      "jku",
      "jwk",
      "p2c",
      "p2s",
      "tag",
      // ⚠ `x5t` is here and `x5t#S256` is NOT, and the asymmetry is RFC 9360 §2's,
      // not a gap: COSE has ONE thumbprint parameter (label 34) whose hash
      // algorithm is a member of the value. `x5t#S256` IS that parameter's COSE
      // form and carries the `certHash` codec; the SHA-1-named JOSE parameter has
      // no COSE spelling of its own to be written under, and is reached on READ
      // only through label 34's `hashAlg` dispatch.
      "x5t",
      "zip",
    ]);

    for (const spec of absent) {
      const key = spec.wire.cose;
      expect(key.kind).toBe("absent");
      if (key.kind !== "absent") continue;
      expect(
        key.reason.length,
        `${spec.domain} has an empty absent reason`,
      ).toBeGreaterThan(20);
    }
  });

  test("every entry declares a required sample", () => {
    for (const spec of HEADER_SPECS) {
      expect(spec.sample, `${spec.domain} has no sample`).toBeDefined();
    }
  });

  test("every sample MATCHES its codec kind, not merely defined", () => {
    // Presence alone lets `sample: 2` sit on a `string` parameter and pass, and
    // the generated per-spec round-trip matrix consumes these samples — so a
    // wrong-shaped one produces a BOGUS round trip rather than a failure. The
    // expectation is derived from the codec kind through an exhaustive switch,
    // so a new HeaderCodec kind is a COMPILE error here.
    for (const spec of HEADER_SPECS) {
      expect(
        sampleMatchesCodec(spec.codec, spec.sample),
        `${spec.domain} sample does not match its ${spec.codec.kind} codec`,
      ).toBe(true);
    }
  });

  test("wire names are unique", () => {
    const jose = HEADER_SPECS.map(headerJoseName);
    expect(new Set(jose).size).toBe(jose.length);
  });

  test("domain names are unique", () => {
    const domain = HEADER_SPECS.map((s) => s.domain);
    expect(new Set(domain).size).toBe(domain.length);
  });

  test("headerByJose / headerByDomain resolve every entry to itself (inverse maps)", () => {
    for (const spec of HEADER_SPECS) {
      expect(headerByJose(headerJoseName(spec))).toBe(spec);
      expect(headerByDomain(spec.domain)).toBe(spec);
    }
  });

  test("known wire<->domain pairs resolve both ways", () => {
    expect(headerByJose("alg")?.domain).toBe("algorithm");
    expect(headerByDomain("keyId")).toBeDefined();
    expect(headerJoseName(headerByDomain("keyId")!)).toBe("kid");
    expect(headerByJose("x5t#S256")?.domain).toBe("certificateThumbprint");
    expect(headerJoseName(headerByDomain("certificateThumbprint")!)).toBe("x5t#S256");
    expect(headerByJose("crit")?.domain).toBe("critical");
  });

  test("the registry DOMAIN set EQUALS the DomainTokenHeader domain fields (no read drift)", () => {
    // Both directions: an extra/renamed registry domain is absent from the witness
    // (fails), a missing one leaves a witness key uncovered (fails). Non-vacuous.
    const domains = HEADER_SPECS.map((s) => s.domain);
    expect(new Set(domains)).toEqual(new Set(Object.keys(PARSED_DOMAIN_FIELDS)));
  });

  test("the registry WIRE set EQUALS the WireTokenHeader wire keys (no write drift)", () => {
    const jose = HEADER_SPECS.map(headerJoseName);
    expect(new Set(jose)).toEqual(new Set(Object.keys(TOKEN_HEADER_WIRE)));
  });

  test("every WireTokenHeader wire key resolves to a registry entry", () => {
    for (const wire of Object.keys(TOKEN_HEADER_WIRE)) {
      expect(
        headerByJose(wire),
        `missing registry entry for wire "${wire}"`,
      ).toBeDefined();
    }
  });

  test("every DomainTokenHeader domain field resolves to a registry entry", () => {
    for (const domain of Object.keys(PARSED_DOMAIN_FIELDS)) {
      expect(
        headerByDomain(domain),
        `missing registry entry for domain "${domain}"`,
      ).toBeDefined();
    }
  });

  test("no header parameter is sensitive", () => {
    // The one CONSTANT column left, and it is grounded: a header parameter is
    // never encrypted content. Pinning it means the first parameter that breaks
    // the pattern has to change this test deliberately.
    //
    // ⚠ `provenance`, `matchable` and `critEligible` were pinned here too. The
    // first two are DELETED — no production code read either, and `matchable`
    // was WRONG: every row said `false` beside a docstring claiming "there is no
    // header MATCHER door at all", while `verify-token.ts:283` raises
    // `token_type_mismatch` against `DomainAssert.tokenType`, which is
    // header-derived. `critEligible` left this list earlier for the opposite
    // reason — it stopped being constant and is pinned by name below.
    for (const spec of HEADER_SPECS) {
      expect(spec.sensitivity, `${spec.domain} is sensitive`).toBe("public");
    }
  });

  /**
   * The `critEligible` set, frozen by name — the parameters a producer may name
   * in `crit` and a verifier will accept there.
   *
   * ⚠ BOTH DIRECTIONS TURN ON THIS LIST, which is what makes freezing it worth a
   * test of its own: `assert-crit-eligible.ts` refuses a mint naming anything
   * outside it, and `reject-unknown-critical.ts` refuses a verify naming
   * anything outside it. Adding a name here silently widens what aegis both
   * emits and accepts as a critical extension, and RFC 7515 §4.1.11 forbids
   * `crit` naming a parameter that specification or JWA defines — so a name
   * added carelessly mints tokens that are malformed for every recipient.
   */
  test("the crit-eligible header parameters are exactly the stated set", () => {
    const eligible = HEADER_SPECS.filter((s) => s.critEligible).map(headerJoseName);

    // `oid` alone, and it is the ONLY candidate there could be: every other JOSE
    // name in this registry is an IANA-registered JOSE header parameter, which
    // RFC 7515 §4.1.11 forbids a producer from naming in `crit` outright.
    expect(eligible).toEqual(["oid"]);
  });

  test("kid and iv are the only entries DECLARED as either-bucket", () => {
    // ⚠ A statement about the REGISTRY column — and the column IS enforced.
    // `build-cose-headers.ts` reads it through `isProtectedOnly` and throws
    // `cose_unprotected_placement` for a protected-only param placed in the
    // unprotected bag, so `cty`/`oid`/`x5u` are refused there. (An earlier
    // version of this note said the builder "never reads placement" and listed
    // those params as accepted; both stopped being true when the placement rule
    // landed.)
    //
    // The two `"either"` rows are the ones the placement rule therefore cannot
    // speak for, which is exactly why the kits must RESERVE them: `CwsKit` emits
    // `kid` unprotected (an advisory routing hint read before the signature
    // check) and `CweKit` adds `iv` (an AEAD input) — and a caller `iv` on a
    // SIGNED COSE format is refused by `KIT_CAPABILITIES`, not by placement.
    const either = HEADER_SPECS.filter((s) => s.placement === "either").map(
      headerJoseName,
    );
    expect(new Set(either)).toEqual(new Set(["kid", "iv"]));
    expect(HEADER_SPECS.filter((s) => s.placement === "unprotected")).toEqual([]);
  });

  /**
   * The `whenEmpty: "refuse"` set, frozen by name — and the EMPTY `keep` set
   * beside it. The column has no default, so a new parameter cannot dodge the
   * decision — but an EXISTING one can be flipped in a one-word diff, and a flip
   * either puts a value on the wire that says nothing, removes one a verifier
   * acts on, or turns a refusal into one of those two. All three are silent, so
   * the sets are pinned here and a change to them has to be a change to this
   * list.
   */
  test("the header parameters refused when empty are exactly the stated set", () => {
    const refuse = HEADER_SPECS.filter((s) => s.whenEmpty === "refuse").map(
      (s) => s.domain,
    );

    // ⚠ The certificate trio is NOT uniform, and this is the split. `x5t#S256` is
    // the ONE header parameter aegis's verify enforces: `verify-cert-binding.ts`
    // skips the check when it is ABSENT and refuses a mismatch when it is
    // present, so presence IS the binding — an empty thumbprint can neither be
    // pruned (that hands the audience an unbound token) nor emitted (that mints a
    // token no certificate satisfies), so the write refuses. `x5t` (never
    // verified, legacy-compat output) and `x5c` (no binding check reads it) sit
    // beside it and PRUNE, because nothing reads either: an empty value there
    // binds nothing and is refused by nothing.
    expect(refuse).toEqual(["certificateThumbprint"]);

    // ⚠ EMPTY, and asserted rather than left unsaid. `keep` stays in the union
    // for the ELEVEN claims that hold it, so nothing about this registry forces
    // it to have a user — which makes "no header parameter keeps" a fact that
    // could be reversed by a one-word diff with nothing to notice. It is also
    // what goes red if someone "tidies" the union down to the two verdicts this
    // registry uses and quietly re-points this parameter at `keep`.
    expect(HEADER_SPECS.filter((s) => s.whenEmpty === "keep")).toEqual([]);

    // ⚠ THE COUNT IS THE ASSERTION, and it is here rather than a loop over the
    // column because a loop CANNOT GO RED. `ParamSpec.whenEmpty` is required and
    // non-optional over a closed union (`registry/param-spec.ts`), so a missing
    // or off-vocabulary cell is a COMPILE error before any test runs — a loop
    // asserting the cell is one of three values only restates what the compiler
    // already refuses, and only a deliberate cast could redden it.
    //
    // What the compiler CANNOT see is a parameter added with a `whenEmpty` the
    // author never thought about. The type forces a cell; nothing forces the
    // DECISION. A count pinned beside the frozen lists is what makes that
    // visible HERE: a twenty-second parameter fails this test, and the only way
    // past it is to read the split above and state which side the new one is on.
    expect(HEADER_SPECS.length).toBe(21);
  });

  test("crit is the only member-transforming (critical) codec kind", () => {
    const critical = HEADER_SPECS.filter((s) => s.codec.kind === "critical").map(
      headerJoseName,
    );
    expect(critical).toEqual(["crit"]);
  });

  test("the full RFC-registered additive set is present as normal caller entries", () => {
    // Caller-supplyable strings that the codec wires in both directions.
    // (`x5t` is not in this set — the kit derives it from the signing key.)
    for (const wire of ["x5u", "zip", "apu", "apv"]) {
      const spec = headerByJose(wire);
      expect(spec, `missing RFC param "${wire}"`).toBeDefined();
      expect(spec?.codec.kind).toBe("string");
    }
  });

  test("the lindorm-proprietary oid param is registered", () => {
    expect(headerByJose("oid")?.domain).toBe("objectId");
    expect(headerByDomain("objectId")).toBeDefined();
  });

  test("oid rides COSE under a lindorm private-use header label (< -65536, round-trips)", () => {
    // oid has no IANA COSE label, so it carries a lindorm private-use label so it
    // can ride the COSE header/unprotected bags at all. It MUST be in the
    // private-use band and round-trip through the label maps.
    const label = coseByJose("oid");
    expect(label).toBeLessThan(-65536);
    expect(headerByCose(label)).toBe(headerByJose("oid"));
  });

  test("the COSE labels the kits emit resolve to their exact IANA integers", () => {
    // The 6 labels the CWS/CWM/CWE/CWT kits actually put on the wire. These
    // integers are byte-load-bearing: a drift here moves every COSE snapshot.
    const emitted: Record<string, number> = {
      alg: 1,
      crit: 2,
      cty: 3,
      kid: 4,
      iv: 5,
      typ: 16,
    };
    for (const [wire, label] of Object.entries(emitted)) {
      expect(coseByJose(wire), `wrong COSE label for "${wire}"`).toBe(label);
    }
  });

  test("coseByJose throws for a param COSE has no plain integer label for", () => {
    // `jwk` is a registered JOSE header with no COSE integer relabel — asking for
    // its label is the drift case the accessor guards.
    expect(() => coseByJose("jwk")).toThrow(/No COSE label/);
  });

  test("coseByJose reports the registry's stated reason for the refusal", () => {
    // The `absent` arm carries the reason, so the refusal explains itself
    // instead of leaving the caller to guess whether it is a gap or a decision.
    try {
      coseByJose("enc");
      expect.unreachable("coseByJose should have thrown");
    } catch (error: any) {
      expect(error.data.jose).toBe("enc");
      expect(error.data.reason).toContain("COSE_Encrypt0");
    }
  });

  test("headerByCose is the inverse of the cose labels (label 1 -> alg spec)", () => {
    const spec = headerByCose(1);
    expect(spec).toBe(headerByJose("alg"));
    expect(spec && headerJoseName(spec)).toBe("alg");
    expect(spec && headerCoseLabel(spec)).toBe(1);
    expect(headerByCose(999)).toBeUndefined();
  });

  test("joseByCose is the name-level inverse", () => {
    expect(joseByCose(1)).toBe("alg");
    expect(joseByCose(16)).toBe("typ");
    expect(joseByCose(999)).toBeUndefined();
  });

  // --- the interop spelling of a private-use label -------------------------
  //
  // ⚠ These are REGISTRY INVARIANTS, stated over every entry rather than over
  // `oid` — which is the whole point. `oid` is the only private-use header
  // parameter today, and a rule written against its name would go on being true
  // while the next one shipped an integer no foreign reader can interpret. What
  // the concrete labels ARE is asserted with literals elsewhere
  // (`classes/cose-private-use-header.test.ts`), where reading them off this
  // registry would make the assertion agree with itself.

  test("coseWireKey degrades EVERY private-use label, and only those", () => {
    for (const spec of HEADER_SPECS) {
      const label = headerCoseLabel(spec);
      if (label === undefined) continue;

      const jose = headerJoseName(spec);
      const name = spec.wire.cose.kind === "absent" ? undefined : spec.wire.cose.name;

      if (isPrivateUseLabel(label)) {
        expect(coseWireKey(jose, false), `${jose} interoperable`).toBe(name);
        expect(coseWireKey(jose, undefined), `${jose} default`).toBe(name);
      } else {
        expect(coseWireKey(jose, false), `${jose} interoperable`).toBe(label);
        expect(coseWireKey(jose, undefined), `${jose} default`).toBe(label);
      }

      // Proprietary is the compact integer for every parameter that has one,
      // private-use or not — the mode never invents a text label.
      expect(coseWireKey(jose, true), `${jose} proprietary`).toBe(label);
    }
  });

  test("the private-use band is non-empty, so the rule above is not vacuous", () => {
    // An invariant quantified over an empty set passes without checking
    // anything. At least one parameter must actually be in the band for the
    // degrade arm to have been exercised at all.
    const band = HEADER_SPECS.filter((spec) => {
      const label = headerCoseLabel(spec);
      return label !== undefined && isPrivateUseLabel(label);
    });

    expect(band.length).toBeGreaterThan(0);
  });

  test("joseByCose resolves the TEXT label of a private-use parameter", () => {
    // The read half. A token minted with the interoperable default carries the
    // string label, so the reader has to answer for it or aegis cannot read back
    // what it just wrote.
    for (const spec of HEADER_SPECS) {
      const label = headerCoseLabel(spec);
      if (label === undefined || !isPrivateUseLabel(label)) continue;

      const jose = headerJoseName(spec);
      expect(joseByCose(coseWireKey(jose, false))).toBe(jose);
      expect(joseByCose(coseWireKey(jose, true))).toBe(jose);
    }
  });

  test("joseByCose does NOT invent a text spelling for a REGISTERED parameter", () => {
    // Answering here would give a registered parameter a second label no
    // specification assigns it, and would let a foreign token deliver `typ` or
    // `cty` under a text key aegis never writes.
    expect(joseByCose("typ")).toBeUndefined();
    expect(joseByCose("cty")).toBeUndefined();
    expect(joseByCose("alg")).toBeUndefined();
    // …not even the stringified integer. RFC 9052 §1.5 admits both forms
    // (`label = int / tstr`) and CBOR keys them apart, so the text "16" is a
    // different label from the integer 16.
    expect(joseByCose("16")).toBeUndefined();
  });

  test("coseWireKey refuses a parameter COSE cannot carry, in either mode", () => {
    for (const proprietary of [false, true]) {
      expect(() => coseWireKey("jwk", proprietary)).toThrow(/No COSE label/);
      expect(() => coseWireKey("nonsense", proprietary)).toThrow(/No COSE label/);
    }
  });

  test("every registry cose label round-trips through headerByCose", () => {
    for (const spec of HEADER_SPECS) {
      const label = headerCoseLabel(spec);
      if (label !== undefined) {
        expect(headerByCose(label)).toBe(spec);
      }
    }
  });

  test("every entry declares a valid codec kind", () => {
    const kinds = new Set([
      "string",
      "url",
      "number",
      "jwk",
      "buffer",
      "array",
      "critical",
    ]);
    for (const spec of HEADER_SPECS) {
      expect(kinds.has(spec.codec.kind), `${spec.domain} has invalid codec kind`).toBe(
        true,
      );
    }
  });

  test("no header parameter carries a per-wire codec override", () => {
    // The per-wire codec exists for the claim side (the token id and the three
    // OIDC hashes: text on JOSE, bytes on COSE). No header parameter needs one
    // today: a parameter either has the same shape on both wires or is `absent`
    // on COSE entirely.
    for (const spec of HEADER_SPECS) {
      expect(spec.codec.per, `${spec.domain} has a per-wire codec`).toBeUndefined();
    }
  });
});
