import type { WireTokenHeader, DomainTokenHeaderOptions } from "../../types/index.js";
import { headerCoseLabel, headerByJose } from "../header/header-registry.js";
import { mapTokenHeader, parseTokenHeader, wireHeaderToCoseMap } from "./token-header.js";
import { describe, expect, test } from "vitest";

describe("data-driven header codec", () => {
  test("the full RFC set (x5t/x5u/zip/apu/apv) round-trips map -> parse", () => {
    const options: DomainTokenHeaderOptions = {
      algorithm: "ES512",
      headerType: "JWS",
      keyId: "test-key-id",
      certificateUrl: "https://example.com/certs",
      zip: "DEF",
      partyProducer: "party-u-info",
      partyRecipient: "party-v-info",
    };

    // `x5t` is kit-derived (provenance: "key"), so it arrives via the cert
    // argument, not the caller-supplyable options — mirroring `x5t#S256`/`x5c`.
    const raw = mapTokenHeader(options, {
      certificateThumbprintSha1: "cert-sha1-thumbprint",
    }) as WireTokenHeader;

    expect(raw.x5t).toBe("cert-sha1-thumbprint");
    expect(raw.x5u).toBe("https://example.com/certs");
    expect(raw.zip).toBe("DEF");
    expect(raw.apu).toBe("party-u-info");
    expect(raw.apv).toBe("party-v-info");

    const parsed = parseTokenHeader(raw as WireTokenHeader);

    expect(parsed.certificateThumbprintSha1).toBe("cert-sha1-thumbprint");
    expect(parsed.certificateUrl).toBe("https://example.com/certs");
    expect(parsed.zip).toBe("DEF");
    expect(parsed.partyProducer).toBe("party-u-info");
    expect(parsed.partyRecipient).toBe("party-v-info");
  });

  test("emitted JSON keys are jose-alphabetical (canonical, byte-order-load-bearing)", () => {
    // The source is deliberately NOT in jose order; the encoder must re-sort so the
    // signed-header bytes stay canonical regardless of caller insertion order.
    const options: DomainTokenHeaderOptions = {
      zip: "DEF",
      keyId: "test-key-id",
      algorithm: "ES512",
      partyRecipient: "v",
      partyProducer: "u",
      headerType: "JWS",
      contentType: "example",
    };

    const raw = mapTokenHeader(options);

    expect(Object.keys(raw)).toEqual(["alg", "apu", "apv", "cty", "kid", "typ", "zip"]);
  });

  test("an unregistered domain key is dropped on write (headers are a closed set)", () => {
    const options = {
      algorithm: "ES512",
      headerType: "JWS",
      keyId: "test-key-id",
      notAHeader: "should-be-dropped",
    } as DomainTokenHeaderOptions;

    const raw = mapTokenHeader(options) as Record<string, unknown>;

    expect(raw.notAHeader).toBeUndefined();
    expect("notAHeader" in raw).toBe(false);
  });

  test("an unregistered wire key is dropped on read", () => {
    const decoded = {
      alg: "ES512",
      typ: "JWS",
      kid: "test-key-id",
      not_a_header: "should-be-dropped",
    } as unknown as WireTokenHeader;

    const parsed = parseTokenHeader(decoded) as Record<string, unknown>;

    expect(parsed.not_a_header).toBeUndefined();
    expect(parsed.notAHeader).toBeUndefined();
  });
});

describe("parseTokenHeader", () => {
  describe("critical parameter handling", () => {
    test("should preserve known critical parameters", () => {
      const decoded: WireTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        crit: ["alg", "typ", "kid"],
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      expect(parsed.critical).toEqual(["algorithm", "headerType", "keyId"]);
    });

    test("should preserve unknown critical parameters", () => {
      const decoded: WireTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        crit: ["unknownParam", "anotherUnknown"],
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      // Unknown params should be passed through as-is for Kit class rejection
      expect(parsed.critical).toEqual(["anotherUnknown", "unknownParam"]);
    });

    test("should preserve mixed known and unknown critical parameters", () => {
      const decoded: WireTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        crit: ["alg", "unknownParam", "kid"],
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      // Should contain both mapped known params and pass-through unknown params
      expect(parsed.critical).toEqual(["algorithm", "keyId", "unknownParam"]);
    });

    test("should handle empty critical array", () => {
      const decoded: WireTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        crit: [],
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      expect(parsed.critical).toEqual([]);
    });

    test("should handle missing critical field", () => {
      const decoded: WireTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      expect(parsed.critical).toEqual([]);
    });

    test("should sort critical parameters alphabetically", () => {
      const decoded: WireTokenHeader = {
        alg: "ES512",
        typ: "JWS",
        crit: ["zulu", "alpha", "bravo"],
        kid: "test-key-id",
      };

      const parsed = parseTokenHeader(decoded);

      expect(parsed.critical).toEqual(["alpha", "bravo", "zulu"]);
    });
  });
});

/**
 * The COSE write pass, folded into this translator from the separate
 * `wire-header-to-cose-map.ts`. It had no test of its own there — which is part
 * of how the COSE header path drifted from the JOSE one.
 */
describe("wireHeaderToCoseMap (the COSE write pass)", () => {
  test("resolves each wire name to the registry's COSE label", () => {
    const map = wireHeaderToCoseMap({ typ: "application/at+jwt", cty: "JWT" });

    // Asserted against the REGISTRY, not against a copy of it here: the label
    // values themselves are frozen by `header-registry.test.ts`.
    expect(map.get(headerCoseLabel(headerByJose("typ")!)!)).toBe("application/at+jwt");
    expect(map.get(headerCoseLabel(headerByJose("cty")!)!)).toBe("JWT");
    expect(map.size).toBe(2);
  });

  test("returns an empty map for an absent bag", () => {
    expect(wireHeaderToCoseMap(undefined).size).toBe(0);
  });

  test("skips an undefined value rather than emitting a null label entry", () => {
    expect(wireHeaderToCoseMap({ typ: undefined, cty: "JWT" }).size).toBe(1);
  });

  test("passes values through UNSHAPED, except crit — order is preserved either way", () => {
    // The deliberate asymmetry with `mapTokenHeader`: the COSE pass does not
    // guard or sort. A change here moves the protected-header bytes.
    const map = wireHeaderToCoseMap({ x5u: "https://b.test", cty: "application/json" });

    expect(map.get(headerCoseLabel(headerByJose("x5u")!)!)).toBe("https://b.test");
    expect(map.get(headerCoseLabel(headerByJose("cty")!)!)).toBe("application/json");
  });

  test("translates crit's MEMBERS to the labels their parameters are keyed under", () => {
    // RFC 9052 §1.5 makes `label = int / tstr`, so the tstr "oid" and the int
    // -70000 the `oid` parameter rides under are DIFFERENT labels — and §3.1
    // makes a crit member naming a label absent from the protected bucket a
    // FATAL error. Emitting the name while keying the parameter by its label
    // produced a token that was malformed by its own crit, which is what this
    // pass did until 2026-08-11. Order is preserved (the reader mirrors it).
    const map = wireHeaderToCoseMap({ crit: ["x5u", "oid"], oid: "1.2.3.4" } as never);

    expect(map.get(headerCoseLabel(headerByJose("crit")!)!)).toEqual([
      headerCoseLabel(headerByJose("x5u")!),
      headerCoseLabel(headerByJose("oid")!),
    ]);
  });

  test("REFUSES a crit member naming a parameter COSE cannot carry", () => {
    // `apu` has no COSE label at all, so there is no label a crit member could
    // name it by — the parameter cannot be marked critical on this wire, and
    // saying so is better than emitting a member that names nothing.
    expect(() => wireHeaderToCoseMap({ crit: ["apu"] } as never)).toThrow(
      expect.objectContaining({ code: "header_no_cose_label" }),
    );
  });

  test("REFUSES a parameter COSE cannot carry, with the registry's stated reason", () => {
    // `apu` is `wireAbsent` — a drop here would silently lose a caller's header.
    expect(() => wireHeaderToCoseMap({ apu: "cGFydHktdQ" } as never)).toThrow(
      expect.objectContaining({ code: "header_no_cose_label" }),
    );
  });

  test("REFUSES an unregistered wire key rather than dropping it", () => {
    expect(() => wireHeaderToCoseMap({ nonsense: "x" } as never)).toThrow(
      expect.objectContaining({ code: "header_no_cose_label" }),
    );
  });
});
