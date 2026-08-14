import type { WireTokenHeader, DomainTokenHeaderOptions } from "../../types/index.js";
import { headerCoseLabel, headerByJose } from "../header/header-registry.js";
import {
  mapTokenHeader,
  parseTokenHeader,
  shapeWireHeader,
  wireHeaderToCoseMap,
} from "./token-header.js";
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
 * The WIRE-KEYED write pass. It exists so the JOSE kits can stay in wire
 * vocabulary end to end: they used to translate the caller's already-wire bag
 * BACK to domain names purely to reach these guards, which put a second crossing
 * point beside the one `domain-header-to-wire.ts` claims to be.
 */
describe("shapeWireHeader (the wire-keyed write pass)", () => {
  test("shapes without translating — the names come out as they went in", () => {
    const shaped = shapeWireHeader({ cty: "JWT", oid: "1.2.3.4" });

    expect(shaped).toEqual({ cty: "JWT", oid: "1.2.3.4" });
  });

  test("drops an unregistered key — headers are a closed set on this pass too", () => {
    const shaped = shapeWireHeader({ cty: "JWT", nonsense: "x" } as never);

    expect("nonsense" in shaped).toBe(false);
    expect(shaped.cty).toBe("JWT");
  });

  test("applies the registry's guard, which is the SAME guard the domain pass applies", () => {
    // The two write passes read a value under different keys and must shape it
    // identically; a `jku` that is not URL-like is dropped either way.
    expect(shapeWireHeader({ jku: "not-a-uri" }).jku).toBeUndefined();
    expect(mapTokenHeader({ jwksUri: "not-a-uri" }).jku).toBeUndefined();

    expect(shapeWireHeader({ jku: "https://a.test/jwks.json" }).jku).toBe(
      "https://a.test/jwks.json",
    );
    expect(mapTokenHeader({ jwksUri: "https://a.test/jwks.json" }).jku).toBe(
      "https://a.test/jwks.json",
    );
  });

  test("drops an undefined value, so a shaped tier cannot overwrite one below it", () => {
    // This is what makes the JOSE header builder's ordering rule hold by
    // construction rather than by each kit remembering it.
    expect("cty" in shapeWireHeader({ cty: undefined })).toBe(false);
  });

  test("does NOT canonicalise key order — a shaped bag is a merge input", () => {
    expect(Object.keys(shapeWireHeader({ zip: "DEF", cty: "JWT" }))).toEqual([
      "zip",
      "cty",
    ]);
  });

  test("sorts crit's members and leaves the wire-named ones alone", () => {
    // The members are already wire names here, so the shared `criticalToWire` is
    // sort-only: no domain name spells `x5u` or `oid`.
    expect(shapeWireHeader({ crit: ["x5u", "oid"] }).crit).toEqual(["oid", "x5u"]);
  });

  test("returns an empty bag for an absent one", () => {
    expect(shapeWireHeader(undefined)).toEqual({});
  });
});

/**
 * The COSE write pass, folded into this translator from the separate
 * `wire-header-to-cose-map.ts`. It had no test of its own there — which is part
 * of how the COSE header path drifted from the JOSE one.
 */
describe("wireHeaderToCoseMap (the COSE write pass)", () => {
  test("resolves each wire name to the registry's COSE label", () => {
    const map = wireHeaderToCoseMap({ typ: "application/at+jwt", cty: "JWT" }, false);

    // Asserted against the REGISTRY, not against a copy of it here: the label
    // values themselves are frozen by `header-registry.test.ts`.
    expect(map.get(headerCoseLabel(headerByJose("typ")!)!)).toBe("application/at+jwt");
    expect(map.get(headerCoseLabel(headerByJose("cty")!)!)).toBe("JWT");
    expect(map.size).toBe(2);
  });

  test("returns an empty map for an absent bag", () => {
    expect(wireHeaderToCoseMap(undefined, false).size).toBe(0);
  });

  test("skips an undefined value rather than emitting a null label entry", () => {
    expect(wireHeaderToCoseMap({ typ: undefined, cty: "JWT" }, false).size).toBe(1);
  });

  test("passes values through UNSHAPED, except crit — order is preserved either way", () => {
    // The deliberate asymmetry with `mapTokenHeader`: the COSE pass does not
    // guard or sort. A change here moves the protected-header bytes.
    const map = wireHeaderToCoseMap(
      { x5u: "https://b.test", cty: "application/json" },
      false,
    );

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
    //
    // ⚠ PROPRIETARY, so both `oid` entries are the integer — the mode that
    // makes this the original defect's shape. The interoperable pair below is
    // the same rule at the other spelling.
    const map = wireHeaderToCoseMap(
      { crit: ["x5u", "oid"], oid: "1.2.3.4" } as never,
      true,
    );

    expect(map.get(headerCoseLabel(headerByJose("crit")!)!)).toEqual([
      headerCoseLabel(headerByJose("x5u")!),
      headerCoseLabel(headerByJose("oid")!),
    ]);
  });

  // The interop default: RFC 8152 §16.2 leaves a label below -65536 to private
  // use, so an integer there means nothing to a foreign reader. Written as its
  // string label instead, the parameter is legible COSE (RFC 9052 §1.5 —
  // `label = int / tstr`).
  //
  // ⚠ The expected keys are LITERALS on purpose. Reading them from the registry
  // would make the test agree with whatever the registry says, including the
  // integer it said before this pair existed.
  test("the interoperable default keys a PRIVATE-USE parameter by its STRING label", () => {
    const map = wireHeaderToCoseMap({ oid: "1.2.3.4" } as never, false);

    expect([...map.keys()]).toEqual(["oid"]);
    expect(map.get("oid")).toBe("1.2.3.4");
    expect(map.has(-70000)).toBe(false);
  });

  test("proprietary keys the SAME parameter by its compact private-use integer", () => {
    const map = wireHeaderToCoseMap({ oid: "1.2.3.4" } as never, true);

    expect([...map.keys()]).toEqual([-70000]);
    expect(map.get(-70000)).toBe("1.2.3.4");
    expect(map.has("oid")).toBe(false);
  });

  // A REGISTERED label is interoperable as it stands, so the mode has nothing to
  // choose — a degrade that also moved `cty` would be inventing a text spelling
  // no specification gives it.
  test("a REGISTERED parameter is the integer in BOTH modes", () => {
    expect([...wireHeaderToCoseMap({ cty: "JWT" }, false).keys()]).toEqual([3]);
    expect([...wireHeaderToCoseMap({ cty: "JWT" }, true).keys()]).toEqual([3]);
  });

  // RFC 9052 §3.1: a crit member naming a label that is not in the protected
  // bucket is "a fatal error in processing the message". So the members follow
  // the parameters into the interoperable spelling — a crit saying -70000 over a
  // bucket keyed "oid" is exactly that fatal error, one spelling apart.
  test("crit's members follow their parameters into the STRING spelling", () => {
    const map = wireHeaderToCoseMap(
      { crit: ["x5u", "oid"], oid: "1.2.3.4" } as never,
      false,
    );

    expect(map.get(2)).toEqual([35, "oid"]);
    expect([...map.keys()]).toEqual([2, "oid"]);
  });

  test("REFUSES a crit member naming a parameter COSE cannot carry", () => {
    // `apu` has no COSE label at all, so there is no label a crit member could
    // name it by — the parameter cannot be marked critical on this wire, and
    // saying so is better than emitting a member that names nothing.
    expect(() => wireHeaderToCoseMap({ crit: ["apu"] } as never, false)).toThrow(
      expect.objectContaining({ code: "header_no_cose_label" }),
    );
  });

  test("REFUSES a parameter COSE cannot carry, with the registry's stated reason", () => {
    // `apu` is `wireAbsent` — a drop here would silently lose a caller's header.
    expect(() => wireHeaderToCoseMap({ apu: "cGFydHktdQ" } as never, false)).toThrow(
      expect.objectContaining({ code: "header_no_cose_label" }),
    );
  });

  test("REFUSES an unregistered wire key rather than dropping it", () => {
    expect(() => wireHeaderToCoseMap({ nonsense: "x" } as never, false)).toThrow(
      expect.objectContaining({ code: "header_no_cose_label" }),
    );
  });
});
