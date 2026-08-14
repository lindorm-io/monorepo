import { describe, expect, test } from "vitest";
import { JoseError } from "../../errors/index.js";
import { buildJoseHeader } from "./build-jose-header.js";

const build = (
  overrides: Partial<Parameters<typeof buildJoseHeader>[0]> = {},
): ReturnType<typeof buildJoseHeader> =>
  buildJoseHeader({
    reserved: ["alg", "kid", "typ"],
    defaults: {},
    header: undefined,
    derived: { alg: "ES512", kid: "key_test", typ: "JWT" },
    cert: undefined,
    error: JoseError,
    ...overrides,
  });

describe("buildJoseHeader", () => {
  describe("the ordering rule: defaults < caller < derived", () => {
    test("a default the caller does not state is written", () => {
      expect(build({ defaults: { cty: "application/json" } }).cty).toBe(
        "application/json",
      );
    });

    test("a caller value OUTRANKS the kit's default", () => {
      // What a default IS. Relabelling the content, or naming the jwks uri the
      // deployment publishes this token under, is the caller's to do.
      const header = build({
        defaults: { cty: "application/json", jku: "https://key.lindorm.test/jwks.json" },
        header: { cty: "JWT", jku: "https://caller.lindorm.test/jwks.json" },
      });

      expect(header.cty).toBe("JWT");
      expect(header.jku).toBe("https://caller.lindorm.test/jwks.json");
    });

    test("a derived value OUTRANKS the caller's", () => {
      // The wire must describe the crypto that actually ran, so what the kit
      // knows wins over what the caller asked for.
      //
      // `enc` is not on this call's reserved row, so it reaches the merge and is
      // beaten THERE rather than being filtered out first — the ordering itself
      // is what this pins. Every real kit reserves every parameter it derives,
      // which is what makes the two tiers disjoint in production; the cast is
      // how a caller value gets far enough to test the tier that backs it up.
      expect(
        build({ header: { enc: "A128GCM" } as never, derived: { enc: "A256GCM" } }).enc,
      ).toBe("A256GCM");
    });
  });

  describe("a tier contributes only the parameters it HAS", () => {
    test("an ABSENT derived value leaves the caller's standing", () => {
      // ⛔ THE DEFECT. Three kits wrote `jku: kryptos.jwksUri ?? undefined` after
      // the caller's bag, so a key that resolved no uri wrote `undefined` over
      // the caller's value and the parameter left the wire altogether. An absent
      // value is an absent PARAMETER — it never overwrites anything.
      const header = build({
        header: { jku: "https://caller.lindorm.test/jwks.json" },
        derived: { alg: "ES512", kid: "key_test", typ: "JWT", jku: undefined },
      });

      expect(header.jku).toBe("https://caller.lindorm.test/jwks.json");
    });

    test("an ABSENT caller value leaves the kit's default standing", () => {
      const header = build({
        defaults: { cty: "application/json" },
        header: { cty: undefined },
      });

      expect(header.cty).toBe("application/json");
    });

    test("a parameter no tier holds is absent, not present-and-undefined", () => {
      const header = build();

      expect("jku" in header).toBe(false);
      expect("cty" in header).toBe(false);
    });
  });

  describe("the reserved row REFUSES the caller's bag", () => {
    test("a caller naming a kit-owned parameter is refused, not quietly overruled", () => {
      // The runtime backstop for the type-level Omit: an `as never` cast, an
      // untyped dict or a JSON body can all name `alg`/`kid`, and the header has
      // to describe the key that actually signed.
      //
      // ⚠ It THROWS, matching `buildCoseHeaders`'s `cose_reserved_header` — one
      // verdict on both wires. Overruling the value silently was survivable only
      // while the kit HAD a value of its own for every reserved param; where it
      // has none (a signing kit handed an `enc`) the caller's went straight to
      // the wire, which is the gap the short reserved rows opened.
      expect(() => build({ header: { alg: "RSA-OAEP" } as never })).toThrow(
        /Header parameter "alg" is key-derived and cannot be set/,
      );

      let thrown: unknown;
      try {
        build({ header: { kid: "attacker-key" } as never });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(JoseError);
      expect(thrown).toMatchObject({
        code: "jose_reserved_header",
        data: { parameter: "kid" },
      });
    });

    test("the refusal is driven by the ROW, not by a hand-built list", () => {
      // The same caller bag reaches the wire on a row that does not list `enc`
      // and is refused on one that does.
      expect(build({ header: { enc: "A128GCM" } as never, derived: {} }).enc).toBe(
        "A128GCM",
      );

      expect(() =>
        build({
          reserved: ["alg", "enc", "kid", "typ"],
          header: { enc: "A128GCM" } as never,
          derived: {},
        }),
      ).toThrow(/Header parameter "enc" is key-derived and cannot be set/);
    });

    test("an explicitly UNDEFINED reserved parameter is absent, not a refusal", () => {
      // `{ ...spread, alg: undefined }` states no parameter at all — the shaping
      // pass would drop it and the wire would carry the kit's own value either
      // way. The COSE twin skips it for the same reason, so refusing here would
      // make the two wires disagree about a bag that emits nothing.
      expect(build({ header: { alg: undefined } as never }).alg).toBe("ES512");
    });
  });

  test("the certificate fields cross from their DOMAIN names", () => {
    // `resolveCertBinding` is a domain-named producer and the only one left, so
    // the crossing happens here — once — rather than in each kit.
    const header = build({
      cert: {
        certificateChain: ["leaf-pem"],
        certificateThumbprint: "sha256-thumbprint",
        certificateThumbprintSha1: "sha1-thumbprint",
      },
    });

    expect(header.x5c).toEqual(["leaf-pem"]);
    expect(header["x5t#S256"]).toBe("sha256-thumbprint");
    expect(header.x5t).toBe("sha1-thumbprint");
  });

  test("the emitted key order is canonical, whatever order the tiers arrived in", () => {
    // The signed bytes are the base64url of this object's JSON, and
    // `JSON.stringify` emits insertion order — so a header assembled from three
    // tiers must not serialise differently from the same header assembled from
    // one.
    const header = build({
      defaults: { cty: "application/json" },
      header: { oid: "1.2.3.4", zip: "DEF" },
      derived: { alg: "ES512", kid: "key_test", typ: "JWT" },
      cert: { certificateThumbprint: "sha256-thumbprint" },
    });

    expect(Object.keys(header)).toEqual([
      "alg",
      "cty",
      "kid",
      "oid",
      "typ",
      "x5t#S256",
      "zip",
    ]);
  });

  describe("the registry shapes every tier", () => {
    test("an unregistered parameter is dropped — headers are a closed set", () => {
      expect(build({ header: { nonsense: "value" } as never }).alg).toBe("ES512");
      expect("nonsense" in build({ header: { nonsense: "value" } as never })).toBe(false);
    });

    test("a value of the wrong shape is dropped by the registry's guard", () => {
      // `jku` is codec `url`, so a bare word is not a jwks uri; dropping it here
      // is what stops the caller's bag reaching the wire unguarded now that it
      // no longer detours through the domain pass.
      expect(build({ header: { jku: "not-a-uri" } }).jku).toBeUndefined();
      expect(build({ header: { cty: 42 } as never }).cty).toBeUndefined();
    });
  });
});
