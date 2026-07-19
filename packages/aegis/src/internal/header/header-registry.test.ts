import { describe, expect, test } from "vitest";
import type { ParsedTokenHeader, TokenHeaderClaims } from "../../types/index.js";
import {
  HEADER_REGISTRY,
  READ_HEADER_SPECS,
  WRITE_HEADER_SPECS,
  headerByDomain,
  headersWith,
  headerByWire,
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
  contentType: true,
  critical: true,
  encryption: true,
  headerType: true,
  initialisationVector: true,
  jwk: true,
  jwksUri: true,
  keyId: true,
  objectId: true,
  pbkdfIterations: true,
  pbkdfSalt: true,
  publicEncryptionJwk: true,
  publicEncryptionTag: true,
  x5c: true,
  x5t: true,
  x5tS256: true,
};

// Witness whose keys ARE the wire keys of TokenHeaderClaims (RFC 7515 §4.1). Same
// type-binding trick: a wire rename in TokenHeaderClaims forces this to change,
// forcing a registry entry to match.
const TOKEN_HEADER_WIRE: Record<keyof TokenHeaderClaims, true> = {
  alg: true,
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
};

describe("HEADER_REGISTRY", () => {
  test("wire names are unique", () => {
    const wire = HEADER_REGISTRY.map((s) => s.wire);
    expect(new Set(wire).size).toBe(wire.length);
  });

  test("domain names are unique", () => {
    const domain = HEADER_REGISTRY.map((s) => s.domain);
    expect(new Set(domain).size).toBe(domain.length);
  });

  test("headerByWire / headerByDomain resolve every entry to itself (inverse maps)", () => {
    for (const spec of HEADER_REGISTRY) {
      expect(headerByWire(spec.wire)).toBe(spec);
      expect(headerByDomain(spec.domain)).toBe(spec);
    }
  });

  test("known wire<->domain pairs resolve both ways", () => {
    expect(headerByWire("alg")?.domain).toBe("algorithm");
    expect(headerByDomain("keyId")?.wire).toBe("kid");
    expect(headerByWire("x5t#S256")?.domain).toBe("x5tS256");
    expect(headerByDomain("x5tS256")?.wire).toBe("x5t#S256");
    expect(headerByWire("crit")?.domain).toBe("critical");
  });

  test("every TokenHeaderClaims wire key has a registry entry (no wire drift)", () => {
    for (const wire of Object.keys(TOKEN_HEADER_WIRE)) {
      expect(
        headerByWire(wire),
        `missing registry entry for wire "${wire}"`,
      ).toBeDefined();
    }
  });

  test("the read (parser) domain set EQUALS the ParsedTokenHeader domain fields", () => {
    const readDomains = READ_HEADER_SPECS.map((s) => s.domain);

    // Both directions: a wrong/extra registry domain is absent from the witness
    // (fails), a missing one leaves a witness key uncovered (fails). Non-vacuous.
    expect(new Set(readDomains)).toEqual(new Set(Object.keys(PARSED_DOMAIN_FIELDS)));
  });

  test("the write (encoder) wire set is EXACTLY the emitted JOSE params, in canonical order", () => {
    // Pins both the SET and the ALPHABETICAL-by-wire order, which is the on-wire
    // JSON key order the signed header bytes depend on.
    expect(WRITE_HEADER_SPECS.map((s) => s.wire)).toEqual([
      "alg",
      "crit",
      "cty",
      "enc",
      "epk",
      "iv",
      "jku",
      "jwk",
      "kid",
      "oid",
      "p2c",
      "p2s",
      "tag",
      "typ",
      "x5c",
      "x5t#S256",
    ]);
  });

  test("the read (parser) wire set is exactly the surfaced JOSE params", () => {
    expect(new Set(READ_HEADER_SPECS.map((s) => s.wire))).toEqual(
      new Set([
        "alg",
        "crit",
        "cty",
        "enc",
        "epk",
        "iv",
        "jku",
        "jwk",
        "kid",
        "oid",
        "p2c",
        "p2s",
        "tag",
        "typ",
        "x5c",
        "x5t",
        "x5t#S256",
      ]),
    );
  });

  test("every write-wired param is also read-wired (an emitted param is parseable)", () => {
    const readWire = new Set(READ_HEADER_SPECS.map((s) => s.wire));
    for (const spec of WRITE_HEADER_SPECS) {
      expect(readWire.has(spec.wire), `${spec.wire} is emitted but not parsed`).toBe(
        true,
      );
    }
  });

  test("key-provenance params are exactly the kryptos-derived set", () => {
    const key = HEADER_REGISTRY.filter((s) => s.provenance === "key").map((s) => s.wire);
    expect(new Set(key)).toEqual(new Set(["alg", "kid", "x5t#S256", "x5c"]));
  });

  test("computed-provenance params are exactly the crypto-produced set", () => {
    const computed = HEADER_REGISTRY.filter((s) => s.provenance === "computed").map(
      (s) => s.wire,
    );
    expect(new Set(computed)).toEqual(new Set(["epk", "iv", "tag", "p2s"]));
  });

  test("crit is the only member-transforming (critical) value kind", () => {
    const critical = HEADER_REGISTRY.filter((s) => s.value === "critical").map(
      (s) => s.wire,
    );
    expect(critical).toEqual(["crit"]);
  });

  test("the full RFC-registered additive set is present in the registry", () => {
    // The 5 Phase-6 additions + they carry provenance/domain even before a codec
    // wires them (x5t is read-only; x5u/zip/apu/apv are registry-only).
    for (const wire of ["x5u", "x5t", "zip", "apu", "apv"]) {
      expect(headerByWire(wire), `missing RFC param "${wire}"`).toBeDefined();
    }
    expect(headerByWire("x5t")?.wiring).toBe("read");
    expect(new Set(headersWith("none").map((s) => s.wire))).toEqual(
      new Set(["x5u", "zip", "apu", "apv"]),
    );
  });

  test("the lindorm-proprietary oid param is registered", () => {
    expect(headerByWire("oid")?.domain).toBe("objectId");
    expect(headerByDomain("objectId")?.provenance).toBe("option");
  });

  test("every entry declares a valid value kind, provenance, and wiring", () => {
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
    const wirings = new Set(["both", "read", "none"]);
    for (const spec of HEADER_REGISTRY) {
      expect(kinds.has(spec.value), `${spec.wire} has invalid value kind`).toBe(true);
      expect(provenances.has(spec.provenance), `${spec.wire} bad provenance`).toBe(true);
      expect(wirings.has(spec.wiring), `${spec.wire} bad wiring`).toBe(true);
    }
  });
});
