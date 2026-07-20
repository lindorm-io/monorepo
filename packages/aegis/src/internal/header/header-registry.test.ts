import { describe, expect, test } from "vitest";
import type { ParsedTokenHeader, TokenHeaderClaims } from "../../types/index.js";
import {
  HEADER_REGISTRY,
  headerByCose,
  headerByDomain,
  headerByJose,
  coseByJose,
} from "./header-registry.js";

// Witness whose keys ARE the DOMAIN fields of ParsedTokenHeader — every field
// EXCEPT the two that have no wire parameter: `baseFormat` (DERIVED from `typ`)
// and `tokenType` (set by the kit after parsing). Typed as a `Record<..., true>`,
// so adding OR removing a ParsedTokenHeader field forces this witness to change
// (compile error), which then forces the registry to change (the runtime checks
// below). This is the both-directions type binding.
const PARSED_DOMAIN_FIELDS: Record<
  Exclude<keyof ParsedTokenHeader, "baseFormat" | "tokenType">,
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

// Witness whose keys ARE the wire keys of TokenHeaderClaims (RFC 7515 §4.1). Same
// type-binding trick: a wire rename in TokenHeaderClaims forces this to change,
// forcing a registry entry to match.
const TOKEN_HEADER_WIRE: Record<keyof TokenHeaderClaims, true> = {
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

describe("HEADER_REGISTRY", () => {
  test("wire names are unique", () => {
    const jose = HEADER_REGISTRY.map((s) => s.jose);
    expect(new Set(jose).size).toBe(jose.length);
  });

  test("domain names are unique", () => {
    const domain = HEADER_REGISTRY.map((s) => s.domain);
    expect(new Set(domain).size).toBe(domain.length);
  });

  test("headerByJose / headerByDomain resolve every entry to itself (inverse maps)", () => {
    for (const spec of HEADER_REGISTRY) {
      expect(headerByJose(spec.jose)).toBe(spec);
      expect(headerByDomain(spec.domain)).toBe(spec);
    }
  });

  test("known wire<->domain pairs resolve both ways", () => {
    expect(headerByJose("alg")?.domain).toBe("algorithm");
    expect(headerByDomain("keyId")?.jose).toBe("kid");
    expect(headerByJose("x5t#S256")?.domain).toBe("certificateThumbprint");
    expect(headerByDomain("certificateThumbprint")?.jose).toBe("x5t#S256");
    expect(headerByJose("crit")?.domain).toBe("critical");
  });

  test("the registry DOMAIN set EQUALS the ParsedTokenHeader domain fields (no read drift)", () => {
    // Both directions: an extra/renamed registry domain is absent from the witness
    // (fails), a missing one leaves a witness key uncovered (fails). Non-vacuous.
    const domains = HEADER_REGISTRY.map((s) => s.domain);
    expect(new Set(domains)).toEqual(new Set(Object.keys(PARSED_DOMAIN_FIELDS)));
  });

  test("the registry WIRE set EQUALS the TokenHeaderClaims wire keys (no write drift)", () => {
    const jose = HEADER_REGISTRY.map((s) => s.jose);
    expect(new Set(jose)).toEqual(new Set(Object.keys(TOKEN_HEADER_WIRE)));
  });

  test("every TokenHeaderClaims wire key resolves to a registry entry", () => {
    for (const wire of Object.keys(TOKEN_HEADER_WIRE)) {
      expect(
        headerByJose(wire),
        `missing registry entry for wire "${wire}"`,
      ).toBeDefined();
    }
  });

  test("every ParsedTokenHeader domain field resolves to a registry entry", () => {
    for (const domain of Object.keys(PARSED_DOMAIN_FIELDS)) {
      expect(
        headerByDomain(domain),
        `missing registry entry for domain "${domain}"`,
      ).toBeDefined();
    }
  });

  test("key-provenance params are exactly the kryptos-derived set", () => {
    const key = HEADER_REGISTRY.filter((s) => s.provenance === "key").map((s) => s.jose);
    expect(new Set(key)).toEqual(new Set(["alg", "kid", "x5t#S256", "x5c"]));
  });

  test("computed-provenance params are exactly the crypto-produced set", () => {
    const computed = HEADER_REGISTRY.filter((s) => s.provenance === "computed").map(
      (s) => s.jose,
    );
    expect(new Set(computed)).toEqual(new Set(["epk", "iv", "tag", "p2s"]));
  });

  test("crit is the only member-transforming (critical) value kind", () => {
    const critical = HEADER_REGISTRY.filter((s) => s.value === "critical").map(
      (s) => s.jose,
    );
    expect(critical).toEqual(["crit"]);
  });

  test("the full RFC-registered additive set is present as normal option entries", () => {
    // The 5 formerly-inert additions are now first-class entries: caller-supplyable
    // strings that the codec wires in both directions.
    for (const wire of ["x5u", "x5t", "zip", "apu", "apv"]) {
      const spec = headerByJose(wire);
      expect(spec, `missing RFC param "${wire}"`).toBeDefined();
      expect(spec?.value).toBe("string");
      expect(spec?.provenance).toBe("option");
    }
  });

  test("the lindorm-proprietary oid param is registered", () => {
    expect(headerByJose("oid")?.domain).toBe("objectId");
    expect(headerByDomain("objectId")?.provenance).toBe("option");
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

  test("headerByCose is the inverse of the cose labels (label 1 -> alg spec)", () => {
    const spec = headerByCose(1);
    expect(spec).toBe(headerByJose("alg"));
    expect(spec?.jose).toBe("alg");
    expect(spec?.cose).toBe(1);
    expect(headerByCose(999)).toBeUndefined();
  });

  test("every registry cose label round-trips through headerByCose", () => {
    for (const spec of HEADER_REGISTRY) {
      if (spec.cose !== undefined) {
        expect(headerByCose(spec.cose)).toBe(spec);
      }
    }
  });

  test("every entry declares a valid value kind and provenance", () => {
    const kinds = new Set([
      "string",
      "url",
      "number",
      "jwk",
      "buffer",
      "array",
      "critical",
    ]);
    const provenances = new Set(["option", "key", "computed"]);
    for (const spec of HEADER_REGISTRY) {
      expect(kinds.has(spec.value), `${spec.jose} has invalid value kind`).toBe(true);
      expect(provenances.has(spec.provenance), `${spec.jose} bad provenance`).toBe(true);
    }
  });
});
