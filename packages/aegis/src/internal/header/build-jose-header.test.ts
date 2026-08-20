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
    custom: undefined,
    derived: { alg: "ES512", kid: "key_test", typ: "JWT" },
    cert: undefined,
    format: "jwt",
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

    /**
     * ⚠ THE `crit` CHECK IS ON THE MERGED HEADER, and a parameter the header does
     * not carry is REFUSED rather than carried. RFC 7515 §7.1 gives the compact
     * serialisation ONE header, so the message is the merged result — but it is
     * assembled from four separately normalised tiers, and a tier cannot answer a
     * question about the whole. Asking once, at the end, is what makes the four
     * tiers indistinguishable to the rule.
     */
    test("a crit naming a parameter no tier holds is refused", () => {
      expect(() => build({ header: { crit: ["oid"] } as never })).toThrow(
        /crit listed parameter "oid" carries no value/,
      );
    });

    test("a crit naming a parameter the caller's own tier empties is refused", () => {
      // The prune has already turned `oid: ""` into an absent `oid` by the time
      // the merged header exists — which is exactly why the check treats absent
      // and empty as one verdict. Both refuse; there is no third state.
      expect(() => build({ header: { crit: ["oid"], oid: "" } as never })).toThrow(
        /crit listed parameter "oid" carries no value/,
      );
    });

    test("a crit naming an UNDEFINED parameter is refused", () => {
      expect(() => build({ header: { crit: ["oid"], oid: undefined } as never })).toThrow(
        /crit listed parameter "oid" carries no value/,
      );
    });

    test("a crit naming a NULL parameter is refused", () => {
      // `null` reaches the bag from a caller that decoded its header options from
      // JSON. It is the third spelling of "no value" and takes the third path
      // through the writer — the `string` codec guard drops it before the prune
      // ever sees it — so it is stated rather than assumed to follow from `""`.
      expect(() => build({ header: { crit: ["oid"], oid: null } as never })).toThrow(
        /crit listed parameter "oid" carries no value/,
      );
    });

    /**
     * ⚠ THE MERGE IS WHY THE CHECK RUNS LAST. `apu` is written by the DERIVED
     * tier — `JweKit.ts:97` writes `apu: partyProducer` from `resolveEcdhParty`,
     * which returns the caller's value verbatim — so a `crit` in the caller's bag
     * names a parameter no other tier can see. Checked per tier, this would refuse
     * a satisfied `crit`; checked on the merge, it accepts it.
     */
    /**
     * ⚠ THE MEMBER MUST BE THE ELIGIBLE ONE. The satisfaction check runs on the
     * MERGED header, so a `crit` in the caller's tier may be answered by a
     * parameter another tier contributed — that is what this pins. It cannot be
     * pinned with `apu`/`x5t`/`cty` any more: RFC 7515 §4.1.11 forbids a producer
     * naming a specification-defined parameter in `crit`, so the eligibility gate
     * refuses those on the caller's bag before any tier is merged.
     *
     * `oid` is caller-supplied on every aegis path, so no PRODUCTION path writes
     * one into `derived`. It is placed there deliberately: this is a unit probe of
     * the BUILDER, which knows nothing about where a value came from, and the
     * cross-tier reach is the property under test.
     */
    test("a crit satisfied by ANOTHER tier is accepted", () => {
      const header = build({
        reserved: ["alg", "kid", "typ"],
        header: { crit: ["oid"] },
        derived: {
          alg: "ES256",
          oid: "1.2.3.4",
          kid: "key_1",
          typ: "application/jwt",
        },
      });

      expect(header.crit).toEqual(["oid"]);
      expect(header.oid).toBe("1.2.3.4");
    });

    test("a crit naming a CERT parameter is refused before any tier is merged", () => {
      // The cert tier crosses from DOMAIN names via `mapTokenHeader`, and all
      // three of its parameters are defined by RFC 7515 (§4.1.6 `x5c`, §4.1.7
      // `x5t`, §4.1.8 `x5t#S256`) — so §4.1.11 forbids a `crit` naming any of
      // them, whatever the merge goes on to produce. The refusal is therefore at
      // the gate, on the caller's bag, and never reaches the merge.
      expect(() =>
        build({
          header: { crit: ["x5t"] } as never,
          derived: { alg: "ES256", kid: "key_1", typ: "application/jwt" },
          cert: { certificateThumbprintSha1: "dGh1bWI" },
        }),
      ).toThrow(
        expect.objectContaining({
          code: "jwt_crit_param_not_permitted",
          data: { crit: ["x5t"], parameter: "x5t" },
        }),
      );
    });

    /**
     * ⚠ A WIRE DOOR TAKES WIRE NAMES, AND A `crit` MEMBER IS A PARAMETER NAME.
     * This used to MINT: `shapeWireHeader` runs `criticalToWire` over the
     * caller's `crit` (`token-header.ts#encodeHeaderValue`), which remapped
     * `objectId` to `oid` and left the header satisfied — while the COSE twin
     * refused the identical call, because a COSE `crit` member is a LABEL (RFC
     * 9052 §1.5) and `objectId` is none. One call, two verdicts, chosen by the
     * encoding.
     *
     * The eligibility gate runs on the caller's bag BEFORE that shaping, so both
     * wires now refuse. The domain door is where a domain name is translated,
     * and it translates this one already (`mapTokenHeader` at the crossing).
     */
    test("a DOMAIN-spelled crit member is refused at a wire door", () => {
      expect(() =>
        build({ header: { crit: ["objectId"], oid: "1.2.3.4" } as never }),
      ).toThrow(
        expect.objectContaining({
          code: "jwt_crit_param_not_permitted",
          data: { crit: ["objectId"], parameter: "objectId" },
        }),
      );
    });

    /**
     * ⚠ THE MEMBER IS A KEY, AND A KEY LOOKUP IS AN OWN-KEY LOOKUP. `crit`'s
     * members are CALLER-CONTROLLED, so `name in header` — or `header[name]` on a
     * plain object — resolves through `Object.prototype`: `crit: ["toString"]`
     * found a function, `isEmpty` called it non-empty, and aegis minted a header
     * whose `crit` names a parameter it does not carry. That is the token RFC 7515
     * §4.1.11 makes invalid for every recipient, produced by the very check written
     * to prevent it. The merged header is handed over as a `Map` (`Object.entries`
     * in, own keys only), so there is no chain to walk. `in` on a caller-influenced
     * key is a BANNED construct in this package.
     *
     * ⚠ The ELIGIBILITY gate answers these first now (it looks the member up in a
     * `Map` too), so the code is `jwt_crit_param_not_permitted` rather than
     * `jwt_invalid_crit`. The refusal has moved one step earlier; what it refuses
     * has not. The satisfaction check's own prototype defence is pinned directly
     * in `assert-crit-satisfied.test.ts`, where no gate stands in front of it.
     */
    test.each(["toString", "constructor", "valueOf", "hasOwnProperty", "__proto__"])(
      "a crit naming the Object.prototype member %s is refused",
      (member) => {
        expect(() => build({ header: { crit: [member] } as never })).toThrow(
          expect.objectContaining({ code: "jwt_crit_param_not_permitted" }),
        );
      },
    );

    test("an UNNAMED empty value in another tier is still pruned", () => {
      // Nothing names them, so the two values go the way every empty prune-cell
      // value goes — the prune is not narrowed by a `crit` existing elsewhere.
      // (`oid` is the crit member because it is the only one a producer may name;
      // the parameters under test are the EMPTY ones in the other tiers.)
      const derivedTier = build({
        reserved: ["alg", "apu", "kid", "typ"],
        header: { crit: ["oid"], oid: "1.2.3.4" },
        derived: { alg: "ECDH-ES", apu: "", kid: "key_1", typ: "application/jwe" },
      });

      expect("apu" in derivedTier).toBe(false);

      const certTier = build({
        header: { crit: ["oid"], oid: "1.2.3.4" },
        cert: { certificateThumbprintSha1: "" },
      });

      expect("x5t" in certTier).toBe(false);
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

    test("an EMPTY reserved parameter the registry prunes is absent, not a refusal", () => {
      // The same rule, widened from `undefined` to "empty where the registry says
      // prune": a parameter that emits nothing is not a parameter, so the bag is
      // normalised BEFORE the reserved check runs. `alg: ""` names no algorithm
      // and reaches neither wire, so refusing it here while the COSE twin drops
      // it would make one bag fatal or legal by its ENCODING alone — which is a
      // choice the presenter makes, not the deployment.
      expect(build({ header: { alg: "" } as never }).alg).toBe("ES512");
    });

    /**
     * ⚠ THE NORMALISATION ANSWERS FIRST, AND THAT IS A COST OF THE ORDERING
     * RULE RATHER THAN A DEFECT IN IT. `x5t#S256` is the one `whenEmpty:
     * "refuse"` cell, so an empty one is refused by {@link normaliseHeaders}
     * before the reserved row is consulted at all — a caller who names it hears
     * `header_empty_parameter` where a caller who gives it a VALUE still hears
     * `jose_reserved_header` (the row below). The reserved message is the more
     * useful of the two here, and it is given up on purpose.
     *
     * ⛔ Do NOT "fix" this by moving the reserved check ahead of the
     * normalisation. Normalise-first is what makes "an absent parameter cannot
     * be a reserved one" true, and reordering would make `{ alg: "" }` throw
     * `jose_reserved_header` — wrong for twenty parameters, to improve the
     * message for one.
     */
    test("an empty parameter the registry REFUSES is answered by the refusal, not the reserved row", () => {
      expect(() =>
        build({
          reserved: ["x5t#S256"],
          header: { "x5t#S256": "" } as never,
        }),
      ).toThrow(
        expect.objectContaining({
          code: "header_empty_parameter",
          data: { parameter: "x5t#S256", whenEmpty: "refuse" },
        }),
      );
    });

    test("a reserved parameter carrying a VALUE still hears the reserved row", () => {
      // The control for the row above: the reserved check is unchanged and still
      // reachable for this parameter. Only the EMPTY case moved.
      expect(() =>
        build({
          reserved: ["x5t#S256"],
          header: { "x5t#S256": "dGh1bWI" } as never,
        }),
      ).toThrow(/Header parameter "x5t#S256" is key-derived and cannot be set/);
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
