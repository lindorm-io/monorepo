import { isArray, isBuffer, isFinite, isObject, isString, isUrlLike } from "@lindorm/is";
import { describe, expect, test } from "vitest";
import type { DomainTokenHeader, WireTokenHeader } from "../../types/index.js";
import type { HeaderCodec } from "../registry/header-spec.js";
import { WIRE_TAGS } from "../registry/wire.js";
import {
  coseByJose,
  HEADER_REGISTRY,
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

describe("HEADER_REGISTRY", () => {
  // --- shared ParamSpec base ------------------------------------------------

  test("the registry declares headers a CLOSED set", () => {
    // The one thing that separates the header registry from the claim one, and
    // the reason `token-header.ts` drops an unregistered key in both directions.
    // Stated once, at registry level.
    expect(HEADER_REGISTRY.unregistered).toBe("drop");
    expect(HEADER_REGISTRY.specs).toBe(HEADER_SPECS);
  });

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
      "x5t",
      "x5t#S256",
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

  test("every entry declares a non-empty direction and a required sample", () => {
    for (const spec of HEADER_SPECS) {
      expect(
        spec.direction.length,
        `${spec.domain} has an empty direction`,
      ).toBeGreaterThan(0);
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

  test("key-provenance params are exactly the kryptos-derived set", () => {
    const key = HEADER_SPECS.filter((s) => s.provenance === "key").map(headerJoseName);
    // `x5t` (SHA-1 thumbprint) is kit-derived like `x5t#S256`/`x5c` — the write
    // side gates its emission behind a boolean, not a caller value.
    expect(new Set(key)).toEqual(new Set(["alg", "kid", "x5t", "x5t#S256", "x5c"]));
  });

  test("computed-provenance params are exactly the crypto-produced set", () => {
    const computed = HEADER_SPECS.filter((s) => s.provenance === "computed").map(
      headerJoseName,
    );
    expect(new Set(computed)).toEqual(new Set(["epk", "iv", "tag", "p2s"]));
  });

  test("no header parameter is issuer-stamped, matchable, sensitive or critical", () => {
    // These four columns are CONSTANT today, and each is grounded: `issuer`
    // provenance is a claim-side concept; there is no header MATCHER door at
    // all; a header parameter is never encrypted content; and aegis implements
    // no crit extension. Pinning them means the first parameter that breaks one
    // of the patterns has to change this test deliberately.
    for (const spec of HEADER_SPECS) {
      expect(spec.provenance, `${spec.domain} is issuer-stamped`).not.toBe("issuer");
      expect(spec.matchable, `${spec.domain} is matchable`).toBe(false);
      expect(spec.sensitivity, `${spec.domain} is sensitive`).toBe("public");
      expect(spec.critical, `${spec.domain} is critical`).toBe(false);
    }
  });

  test("kid and iv are the only entries DECLARED as either-bucket", () => {
    // ⚠ A statement about the REGISTRY column, NOT an enforced guarantee.
    // `build-cose-headers.ts` never reads `placement` — it refuses only
    // crit-in-unprotected, crit-listed params, the kit's reserved labels and a
    // param in both bags — so a caller CAN put `typ`/`cty`/`x5c`/`x5u`/`oid` in
    // the unprotected bag today (the red `unprotected-typ` scenarios).
    // The two `"either"` rows do describe the kits: `CwsKit` emits `kid`
    // unprotected (an advisory routing hint read before the signature check) and
    // `CweKit` adds `iv` (an AEAD input).
    const either = HEADER_SPECS.filter((s) => s.placement === "either").map(
      headerJoseName,
    );
    expect(new Set(either)).toEqual(new Set(["kid", "iv"]));
    expect(HEADER_SPECS.filter((s) => s.placement === "unprotected")).toEqual([]);
  });

  test("crit is the only member-transforming (critical) codec kind", () => {
    const critical = HEADER_SPECS.filter((s) => s.codec.kind === "critical").map(
      headerJoseName,
    );
    expect(critical).toEqual(["crit"]);
  });

  test("the full RFC-registered additive set is present as normal caller entries", () => {
    // Caller-supplyable strings that the codec wires in both directions.
    // (`x5t` is not in this set — it is `provenance: "key"`, kit-derived.)
    for (const wire of ["x5u", "zip", "apu", "apv"]) {
      const spec = headerByJose(wire);
      expect(spec, `missing RFC param "${wire}"`).toBeDefined();
      expect(spec?.codec.kind).toBe("string");
      expect(spec?.provenance).toBe("caller");
    }
  });

  test("the lindorm-proprietary oid param is registered", () => {
    expect(headerByJose("oid")?.domain).toBe("objectId");
    expect(headerByDomain("objectId")?.provenance).toBe("caller");
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

  test("every registry cose label round-trips through headerByCose", () => {
    for (const spec of HEADER_SPECS) {
      const label = headerCoseLabel(spec);
      if (label !== undefined) {
        expect(headerByCose(label)).toBe(spec);
      }
    }
  });

  test("every entry declares a valid codec kind and provenance", () => {
    const kinds = new Set([
      "string",
      "url",
      "number",
      "jwk",
      "buffer",
      "array",
      "critical",
    ]);
    const provenances = new Set(["caller", "key", "computed", "issuer"]);
    for (const spec of HEADER_SPECS) {
      expect(kinds.has(spec.codec.kind), `${spec.domain} has invalid codec kind`).toBe(
        true,
      );
      expect(provenances.has(spec.provenance), `${spec.domain} bad provenance`).toBe(
        true,
      );
    }
  });

  test("no header parameter carries a per-wire codec override", () => {
    // The per-wire codec exists for the claim side (`jti` text / `cti` bstr).
    // No header parameter needs one today: a parameter either has the same shape
    // on both wires or is `absent` on COSE entirely.
    for (const spec of HEADER_SPECS) {
      expect(spec.codec.per, `${spec.domain} has a per-wire codec`).toBeUndefined();
    }
  });
});
