import type { WireTokenHeader, DomainTokenHeaderOptions } from "../../types/index.js";
import { AegisDomainError } from "../../errors/index.js";
import { headerCoseLabel, headerByJose } from "../header/header-registry.js";
import {
  mapTokenHeader,
  parseTokenHeader,
  shapeWireHeader,
  wireHeaderToCoseMap,
} from "./token-header.js";
import { describe, expect, test } from "vitest";

describe("data-driven header codec", () => {
  test("the full RFC set (x5t/x5u/apu/apv) round-trips map -> parse", () => {
    const options: DomainTokenHeaderOptions = {
      algorithm: "ES512",
      headerType: "JWS",
      keyId: "test-key-id",
      certificateUrl: "https://example.com/certs",
      partyProducer: "party-u-info",
      partyRecipient: "party-v-info",
    };

    // `x5t` is derived from the signing key, so it arrives via the cert
    // argument, not the caller-supplyable options — mirroring `x5t#S256`/`x5c`.
    const raw = mapTokenHeader(options, {
      certificateThumbprintSha1: "cert-sha1-thumbprint",
    }) as WireTokenHeader;

    expect(raw.x5t).toBe("cert-sha1-thumbprint");
    expect(raw.x5u).toBe("https://example.com/certs");
    expect(raw.apu).toBe("party-u-info");
    expect(raw.apv).toBe("party-v-info");

    const parsed = parseTokenHeader(raw as WireTokenHeader);

    expect(parsed.certificateThumbprintSha1).toBe("cert-sha1-thumbprint");
    expect(parsed.certificateUrl).toBe("https://example.com/certs");
    expect(parsed.partyProducer).toBe("party-u-info");
    expect(parsed.partyRecipient).toBe("party-v-info");
  });

  test("emitted JSON keys are jose-alphabetical (canonical, byte-order-load-bearing)", () => {
    // The source is deliberately NOT in jose order; the encoder must re-sort so the
    // signed-header bytes stay canonical regardless of caller insertion order.
    const options: DomainTokenHeaderOptions = {
      certificateUrl: "https://example.com/certs",
      keyId: "test-key-id",
      algorithm: "ES512",
      partyRecipient: "v",
      partyProducer: "u",
      headerType: "JWS",
      contentType: "example",
    };

    const raw = mapTokenHeader(options);

    expect(Object.keys(raw)).toEqual(["alg", "apu", "apv", "cty", "kid", "typ", "x5u"]);
  });

  /**
   * ⛔ COMPRESSION CROSSES NEITHER PASS, in either vocabulary. aegis compresses no
   * payload, so no registry row answers for `zip`: the domain crossing refuses it
   * by name and the emission boundary disposes of it. RFC 7516 §4.1.3.
   */
  test("compression is refused by name at the domain crossing", () => {
    expect(() => mapTokenHeader({ zip: "DEF" } as never)).toThrow(
      expect.objectContaining({
        code: "header_unknown_parameter",
        data: { parameter: "zip" },
      }),
    );
  });

  test("compression is not a parameter the emission boundary carries", () => {
    expect(shapeWireHeader({ zip: "DEF" } as never)).toEqual({});
  });

  test("an unregistered domain key is refused by name on write, as an aegis domain error", () => {
    const options = {
      algorithm: "ES512",
      headerType: "JWS",
      keyId: "test-key-id",
      notAHeader: "stated",
    } as DomainTokenHeaderOptions;

    expect(() => mapTokenHeader(options)).toThrow(AegisDomainError);
    expect(() => mapTokenHeader(options)).toThrow(
      expect.objectContaining({
        code: "header_unknown_parameter",
        data: { parameter: "notAHeader" },
      }),
    );
  });

  test("an unregistered domain key is refused even when its value is empty", () => {
    expect(() => mapTokenHeader({ notAHeader: "" } as never)).toThrow(
      expect.objectContaining({
        code: "header_unknown_parameter",
        data: { parameter: "notAHeader" },
      }),
    );
  });

  test("a __proto__ key is refused by name like any other unknown parameter", () => {
    const options = JSON.parse('{ "__proto__": "stated" }') as DomainTokenHeaderOptions;

    expect(() => mapTokenHeader(options)).toThrow(
      expect.objectContaining({
        code: "header_unknown_parameter",
        data: { parameter: "__proto__" },
      }),
    );
  });

  test("a registered parameter named by its wire spelling is refused, naming its domain spelling", () => {
    expect(() => mapTokenHeader({ oid: "1.2.3.4" } as never)).toThrow(AegisDomainError);
    expect(() => mapTokenHeader({ oid: "1.2.3.4" } as never)).toThrow(
      expect.objectContaining({
        code: "header_not_domain_named",
        data: { parameter: "oid", expected: "objectId" },
      }),
    );
  });

  test("a wire-spelled parameter is refused even when its value is empty", () => {
    expect(() => mapTokenHeader({ cty: "" } as never)).toThrow(
      expect.objectContaining({
        code: "header_not_domain_named",
        data: { parameter: "cty", expected: "contentType" },
      }),
    );
  });

  test("the one parameter spelled alike at both tiers is carried, not refused", () => {
    const jwk = { kty: "EC", crv: "P-256", x: "eA", y: "eQ" };

    expect(mapTokenHeader({ jwk } as never)).toEqual({ jwk });
  });

  test("an undefined value is an unset field, never refused, under any name", () => {
    expect(
      mapTokenHeader({
        objectId: undefined,
        notAHeader: undefined,
        oid: undefined,
        keyId: "key_test",
      } as never),
    ).toEqual({ kid: "key_test" });
  });

  test("a kit-owned certificate field a caller states reaches the wire bag for the kit to refuse", () => {
    expect(mapTokenHeader({ certificateChain: ["MIIB"] } as never)).toEqual({
      x5c: ["MIIB"],
    });
  });

  test("the kit-derived certificate fields are carried under their wire names", () => {
    expect(
      mapTokenHeader(
        { keyId: "key_test" },
        { certificateChain: ["MIIB"], certificateThumbprint: "dGh1bWI" },
      ),
    ).toEqual({ kid: "key_test", x5c: ["MIIB"], "x5t#S256": "dGh1bWI" });
  });

  test("the DOMAIN crossing removes an empty value the registry says carries nothing", () => {
    // ⚠ The crossing, not only the emission boundary, and that is load-bearing:
    // every kit reads the caller's `cty` BEFORE the header is assembled
    // (`serialiseContent(data, options.header?.cty)`), so this is the only pass
    // early enough to stop an empty one deciding the payload's serialisation.
    const raw = mapTokenHeader({
      contentType: "",
      objectId: "",
      critical: [],
      keyId: "key_test",
    }) as Record<string, unknown>;

    expect(raw).toEqual({ kid: "key_test" });
  });

  test("the DOMAIN crossing prunes an empty value even where crit names it", () => {
    // This pass is a FRAGMENT of a message and makes no judgement about `crit`.
    // The contradiction — a producer stating that a recipient must understand a
    // parameter while giving it nothing to understand — is refused once, on the
    // assembled header, by the builder that owns the message
    // (`header/assert-crit-satisfied.ts`). A prune here cannot HIDE it: the
    // absent parameter and the empty one reach that check as one verdict.
    const raw = mapTokenHeader({
      contentType: "",
      objectId: "",
      critical: ["objectId"],
      keyId: "key_test",
    }) as Record<string, unknown>;

    expect(raw).toEqual({ crit: ["oid"], kid: "key_test" });
  });

  test("the DOMAIN crossing translates a crit member to its wire name", () => {
    // ONE VOCABULARY: `criticalToWire` maps the member `objectId` to `oid` in the
    // same pass that writes the parameter under `oid`, which is what lets the
    // assembled-header check compare members against keys at all.
    const raw = mapTokenHeader({
      objectId: "1.2.3.4",
      critical: ["objectId"],
      keyId: "key_test",
    }) as Record<string, unknown>;

    expect(raw).toEqual({ crit: ["oid"], kid: "key_test", oid: "1.2.3.4" });
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
  describe("the members it reports", () => {
    test("reports exactly the members the wire carried", () => {
      expect(parseTokenHeader({ alg: "HS256" })).toStrictEqual({
        algorithm: "HS256",
        critical: [],
      });
    });

    test("a wire key whose value is undefined reports no member", () => {
      expect(parseTokenHeader({ alg: "HS256", kid: undefined })).toStrictEqual({
        algorithm: "HS256",
        critical: [],
      });
    });

    test("an undefined inside an array-valued member is not reported", () => {
      const decoded = { alg: "ES512", x5c: ["MIIB", undefined] } as never;

      expect(parseTokenHeader(decoded)).toStrictEqual({
        algorithm: "ES512",
        certificateChain: ["MIIB"],
        critical: [],
      });
    });

    test("an undefined inside an object-valued member is not reported", () => {
      const decoded = {
        alg: "ECDH-ES",
        epk: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: undefined },
      } as never;

      expect(parseTokenHeader(decoded)).toStrictEqual({
        algorithm: "ECDH-ES",
        critical: [],
        publicEncryptionJwk: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ" },
      });
    });

    test("a byte-string member is reported as the same instance", () => {
      const bytes = Buffer.from([1, 2]);

      const header = parseTokenHeader({ alg: "ES512", cty: bytes } as never);

      expect(header.contentType).toBe(bytes);
    });

    test("a map-valued member is reported as the same instance", () => {
      const map = new Map([[1, "a"]]);

      const header = parseTokenHeader({ alg: "ES512", cty: map } as never);

      expect(header.contentType).toBe(map);
    });

    test("derives the JOSE family from a typ that names one", () => {
      expect(parseTokenHeader({ alg: "HS256", typ: "JWT" })).toStrictEqual({
        algorithm: "HS256",
        baseFormat: "JWT",
        critical: [],
        headerType: "JWT",
      });
    });
  });

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
 * vocabulary end to end: without it a kit translates its already-wire bag BACK to
 * domain names purely to reach these guards, which is a second crossing point
 * beside the one `domain-header-to-wire.ts` claims to be.
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
    expect(
      Object.keys(shapeWireHeader({ x5u: "https://example.com/certs", cty: "JWT" })),
    ).toEqual(["x5u", "cty"]);
  });

  test("sorts crit's members and leaves the wire-named ones alone", () => {
    // The members are already wire names here, so the shared `criticalToWire` is
    // sort-only: no domain name spells `x5u` or `oid`.
    expect(shapeWireHeader({ crit: ["x5u", "oid"] }).crit).toEqual(["oid", "x5u"]);
  });

  test("returns an empty bag for an absent one", () => {
    expect(shapeWireHeader(undefined)).toEqual({});
  });

  test("removes the empty value the registry says carries nothing", () => {
    // The emission-boundary half of the same rule the `undefined` drop above
    // states: a parameter that emits nothing is not a parameter. `crit: []` is
    // the sharpest case — RFC 7515 §4.1.11 forbids producing it and aegis's own
    // reader refuses one, so a shaped bag that kept it would build a token aegis
    // would not verify.
    const shaped = shapeWireHeader({ crit: [], cty: "", oid: "", kid: "key_test" });

    expect(shaped).toEqual({ kid: "key_test" });
  });

  test("refuses the empty thumbprint aegis BINDS on", () => {
    // `x5t#S256` is the one `whenEmpty: "refuse"` cell: presence IS the binding
    // (`verify-cert-binding.ts`), so an empty one can be neither pruned — that
    // hands the audience an unbound token — nor emitted, which mints a token no
    // certificate satisfies. The emission boundary throws instead.
    expect(() => shapeWireHeader({ "x5t#S256": "" } as never)).toThrow(
      expect.objectContaining({ code: "header_empty_parameter" }),
    );
  });

  test("drops an unregistered key rather than pruning or refusing it", () => {
    // The closed-set rule, which is a DIFFERENT rule: a key with no registry
    // entry has answered no `whenEmpty` question, so the prune never touches it
    // and the JOSE write pass drops it on the line below.
    expect(shapeWireHeader({ nonsense: "", kid: "key_test" } as never)).toEqual({
      kid: "key_test",
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
    // The tstr "oid" and the int -70000 the `oid` parameter rides under are
    // DIFFERENT labels (RFC 9052 §1.5), and a crit member naming a label absent
    // from the protected bucket is a FATAL error (RFC 9052 §3.1) — so emitting the
    // NAME while keying the parameter by its LABEL produces a token malformed by
    // its own crit. Order is preserved (the reader mirrors it).
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
  // ⚠ The expected keys are LITERALS on purpose: read from the registry, the test
  // would agree with whatever the registry says.
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

  test("REFUSES an unregistered wire key whose value is EMPTY, too", () => {
    // The prune must not reach an unregistered key, on this pass above all: the
    // closed-set rule REFUSES here only AFTER the bag is normalised, so a prune
    // taking the key first would turn a refusal a caller must hear into silence.
    expect(() => wireHeaderToCoseMap({ nonsense: "" } as never, false)).toThrow(
      expect.objectContaining({ code: "header_no_cose_label" }),
    );
  });

  test("removes the empty value the registry says carries nothing", () => {
    // The COSE half of the JOSE rule above, and the reason it is stated on both
    // passes: an empty `crit` is forbidden on both wires (RFC 9052 §3.1,
    // RFC 7515 §4.1.11), so a wire emitting one is refused by aegis's own reader.
    const map = wireHeaderToCoseMap({ crit: [], cty: "", typ: "application/cwt" }, false);

    expect(map.size).toBe(1);
    expect(map.get(16)).toBe("application/cwt");
  });
});
