import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_ENC, TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { CweKit } from "../../classes/CweKit.js";
import { CwsKit } from "../../classes/CwsKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import type { AegisError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import { domainTokenHeader } from "../utils/domain-header.js";

// The fixture keys carry fixed validity windows, so the clock is pinned — the
// same instant `Aegis.test.ts` pins.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const logger = createMockLogger();

const WIRE_CLAIMS = { iss: "https://issuer.lindorm.io/", sub: "user-1" };

/** A COSE_Encrypt0 recipient key — aegis's CWE outer takes a `dir` key (RFC 9052 §5.2). */
const CWE_KEY = KryptosKit.generate.enc.oct({
  algorithm: "dir",
  encryption: "A256GCM",
});

/** The unregistered parameter every row here carries — no registry row answers for it. */
const HINT = "x-lindorm-hint";

/**
 * A header bag carrying `__proto__` as an OWN property — the shape `JSON.parse`
 * produces and an object literal cannot. It is the realistic arrival path for the
 * registered bag, whose TYPE is otherwise closed.
 */
const poisoned = (inner: string): Record<string, unknown> =>
  JSON.parse(String.raw`{"__proto__":` + inner + `}`) as Record<string, unknown>;

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return (error as AegisError).code;
  }

  return undefined;
};

/**
 * CUSTOM (unregistered) header parameters, end to end and through the PUBLIC kit
 * doors on both wires.
 *
 * ⚠ THE ROUND TRIP IS THE CLAIM, not the emission: a parameter aegis writes and
 * cannot read back loses silently, so every carriage row mints through a kit and
 * reads the SAME kit's decode.
 *
 * The refusal rows state where the open set STOPS — `header` keeps its registered
 * vocabulary and `custom` keeps everything else, which is what lets a typo in
 * `header` stay a compile error while a typo in `custom` is just a custom
 * parameter.
 */
describe("custom header parameters", () => {
  describe("carriage", () => {
    test("a custom param rides the JOSE protected header and reads back verbatim", () => {
      const kit = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      const token = kit.sign(WIRE_CLAIMS, {
        custom: { header: { [HINT]: "carried" } },
      });

      const decoded = JwtKit.decode(token);

      expect(decoded.custom.header).toEqual({ [HINT]: "carried" });
      // ⚠ NOT in the typed bag. `WireTokenHeader` says an unregistered key cannot
      // exist, so a reader that found one there would be reading a typed lie.
      expect(decoded.header).not.toHaveProperty(HINT);
      // ONE bucket, not an empty second one: a JWT has no unprotected half of
      // either bag (RFC 7515 §7.1).
      expect(Object.keys(decoded.custom)).toEqual(["header"]);
    });

    test("the same param rides the COSE protected bucket under a TSTR label", () => {
      const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      const token = kit.sign(WIRE_CLAIMS, {
        custom: { protected: { [HINT]: "carried" } },
      });

      const decoded = CwtKit.decode(token);

      // An unregistered parameter has no integer label to be written under, so the
      // two wires spell it identically and the read side keys the custom bag by
      // `String(label)`. RFC 9052 §1.5.
      expect(decoded.custom.protected).toEqual({ [HINT]: "carried" });
      expect(decoded.protectedHeader).not.toHaveProperty(HINT);
    });

    test("a custom param rides the COSE UNPROTECTED bucket and round-trips", () => {
      const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger });

      const token = kit.sign(Buffer.from("opaque"), {
        custom: { unprotected: { [HINT]: "advisory" } },
      });

      const decoded = CwsKit.decode(token);

      expect(decoded.custom.unprotected).toEqual({ [HINT]: "advisory" });
      expect(decoded.custom.protected).toEqual({});
    });

    test("the JWE and CWE doors carry one too", () => {
      const jwe = new JweKit({ kryptos: TEST_EC_KEY_ENC, logger });
      const cwe = new CweKit({ kryptos: CWE_KEY, logger });

      expect(
        JweKit.decode(jwe.encrypt("secret", { custom: { header: { [HINT]: "a" } } }))
          .custom.header,
      ).toEqual({ [HINT]: "a" });

      expect(
        CweKit.decode(cwe.encrypt("secret", { custom: { protected: { [HINT]: "a" } } }))
          .custom.protected,
      ).toEqual({ [HINT]: "a" });
    });

    test("a JWS carries one beside the registered bag, and neither displaces the other", () => {
      const kit = new JwsKit({ kryptos: TEST_EC_KEY_SIG, logger });

      const decoded = JwsKit.decode(
        kit.sign("data", {
          header: { oid: "1.2.3.4" },
          custom: { header: { [HINT]: "carried" } },
        }),
      );

      expect(decoded.header.oid).toBe("1.2.3.4");
      expect(decoded.custom.header).toEqual({ [HINT]: "carried" });
    });

    // ⛔ THE WRITE SIDE HAS THE SAME ASSIGNMENT HAZARD: `bag[key] = value` on a
    // plain `{}` with `key` of `"__proto__"` sets the prototype instead of the
    // parameter, so the request vanishes (`build-custom-header.ts`).
    test("a caller's `__proto__` custom param round-trips instead of vanishing", () => {
      const kit = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      const token = kit.sign(WIRE_CLAIMS, {
        custom: { header: { ["__proto__"]: "carried" } },
      });

      expect(Object.keys(JwtKit.decode(token).custom.header)).toEqual(["__proto__"]);
      expect(({} as Record<string, unknown>).carried).toBeUndefined();
    });
    /**
     * ⛔ THE REGISTERED BAG HAS THE SAME ASSIGNMENT HAZARD, and it bites HARDER:
     * `build-jose-header.ts` copies the caller's header into a plain `{}` and then
     * reads `caller.crit` off it, so an own `__proto__` carrying a `crit` refuses a
     * token whose caller never wrote one. `pruneEmptyHeaders` copies the same way.
     *
     * ⚠ The bag is TYPED closed, so this arrives only from an untyped path. The
     * type is not the guard here; the copy is.
     */
    test("an own `__proto__` in the REGISTERED bag does not forge a `cty`", () => {
      // `JwsKit.sign` reads `callerHeader.cty` off the normalised bag, so a
      // prototype that answers puts a content type the caller never wrote on the
      // SIGNED bytes.
      const kit = new JwsKit({ kryptos: TEST_EC_KEY_SIG, logger });

      const token = kit.sign({ a: 1 }, { header: poisoned('{"cty":"text/plain"}') });

      expect(JwsKit.decode(token).header.cty).toBe("application/json");
      expect(({} as Record<string, unknown>).cty).toBeUndefined();
    });

    test("an own `__proto__` in the REGISTERED bag does not forge a `crit`", () => {
      // ⚠ IT STILL THROWS, and the CODE is the whole assertion: `__proto__` is an
      // ordinary own key of the registered bag, so it is refused as the UNREGISTERED
      // name it is — a verdict about what the CALLER wrote. A `crit` verdict here
      // would be a verdict about what the prototype said (`build-cose-headers.ts`
      // reads `headerBag.crit`).
      const cwt = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      expect(
        codeOf(() =>
          cwt.sign(WIRE_CLAIMS, { header: poisoned('{"crit":["injected"]}') }),
        ),
      ).toBe("header_no_cose_label");

      // JOSE drops an unregistered key from the registered bag rather than
      // refusing it, so there the mint succeeds and carries no forged `crit`.
      const jwt = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
      const token = jwt.sign(WIRE_CLAIMS, { header: poisoned('{"crit":["injected"]}') });

      expect(JwtKit.decode(token).header.crit).toBeUndefined();
      expect(({} as Record<string, unknown>).crit).toBeUndefined();
    });
  });

  describe("what the custom bag refuses", () => {
    // ⚠ A REGISTERED name belongs in `header`, where its value codec and its bucket
    // placement apply. Accepting it in `custom` would make the split an override
    // door — the parameter travelling raw, past every rule its registry row states.
    test("the JOSE doors refuse a REGISTERED name in custom.header", () => {
      const custom = { header: { cty: "application/json" } };

      // `data.bucket` names the field the caller wrote, so the JOSE verdict says
      // `header` — the JOSE envelope declares no `protected`
      // (`types/header/wire-envelope.ts`).
      const refusal = expect.objectContaining({
        code: "header_registered_in_custom",
        data: { parameter: "cty", bucket: "header" },
      });

      expect(() =>
        new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(WIRE_CLAIMS, { custom }),
      ).toThrow(refusal);

      expect(() =>
        new JwsKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign("data", { custom }),
      ).toThrow(refusal);
    });

    test("the COSE doors refuse a REGISTERED name in either custom bucket", () => {
      const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      for (const bucket of ["protected", "unprotected"] as const) {
        expect(
          codeOf(() =>
            kit.sign(WIRE_CLAIMS, {
              custom: { [bucket]: { cty: "application/json" } },
            }),
          ),
        ).toBe("header_registered_in_custom");
      }
    });

    /**
     * ⛔ A SPEC-DEFINED NAME AEGIS DOES NOT IMPLEMENT IS STILL NOT CUSTOM. Admitted
     * into `custom` it would ride as an unregistered hint while a conformant reader
     * gives it its published meaning — and for `iss`/`sub`/`aud` that meaning is an
     * unencrypted replica of the claim (RFC 7519 §5.3), so a forged one is a
     * confusion attack rather than an inert hint.
     *
     * ⚠ Whether a name is spec-defined is ONE predicate both sides read
     * (`internal/header/is-spec-defined-header-param.ts`); two lists disagreeing is
     * what produces the asymmetry.
     */
    test.each(["iss", "sub", "aud", "client_id", "trust_chain"])(
      "a registered name aegis does not implement (%s) cannot be forged as custom",
      (name) => {
        const kit = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

        expect(
          codeOf(() =>
            kit.sign(WIRE_CLAIMS, {
              custom: { header: { [name]: "https://attacker.example/" } },
            }),
          ),
        ).toBe("header_registered_in_custom");
      },
    );

    test.each(["b64", "ppt", "url", "nonce", "svt"])(
      "a spec-defined name aegis does not implement (%s) is refused from custom",
      (name) => {
        const kit = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

        expect(
          codeOf(() =>
            kit.sign(WIRE_CLAIMS, { custom: { header: { [name]: "value" } } }),
          ),
        ).toBe("header_registered_in_custom");
      },
    );

    test("so a crit naming one can no longer mint a token aegis refuses on read", () => {
      const kit = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      // The refusal lands at the MINT, which is the only place the caller can
      // still choose differently — rather than at the verify of a token already
      // issued to somebody.
      expect(
        codeOf(() =>
          kit.sign(WIRE_CLAIMS, {
            header: { crit: ["b64"] },
            custom: { header: { b64: false } },
          }),
        ),
      ).toBe("header_registered_in_custom");
    });

    // ⚠ A SUBSET of the rule above with its OWN code, because the repair differs: a
    // kit-owned parameter is refused from `header` too, so "put it in the header
    // bag" would send the caller to a bag whose type Omits it
    // (`KitOwnedHeaderParam`).
    test("both wires refuse a KIT-OWNED name in custom, distinctly", () => {
      const jwt = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
      const cwt = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      // Each wire's verdict names ITS OWN field, which is why the two literals are
      // written out rather than shared.
      expect(() =>
        jwt.sign(WIRE_CLAIMS, { custom: { header: { alg: "ES256" } } }),
      ).toThrow(
        expect.objectContaining({
          code: "header_kit_owned_in_custom",
          data: { parameter: "alg", bucket: "header" },
        }),
      );

      expect(() =>
        cwt.sign(WIRE_CLAIMS, { custom: { protected: { alg: "ES256" } } }),
      ).toThrow(
        expect.objectContaining({
          code: "header_kit_owned_in_custom",
          data: { parameter: "alg", bucket: "protected" },
        }),
      );
    });

    // BOTH BUCKETS, like the registered-name rule beside it: `buildCustomHeader` is
    // bucket-agnostic, and a row covering one bucket would read as meaningful.
    test.each(["protected", "unprotected"] as const)(
      "the COSE doors refuse a KIT-OWNED name in custom.%s",
      (bucket) => {
        const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

        expect(
          codeOf(() => kit.sign(WIRE_CLAIMS, { custom: { [bucket]: { alg: "ES256" } } })),
        ).toBe("header_kit_owned_in_custom");
      },
    );
  });

  describe("crit and custom parameters", () => {
    // An issuer's own extension is what `crit` is for (RFC 7515 §4.1.11).
    test("a crit naming a custom.header key mints, and a DECLARING kit verifies it", () => {
      const kit = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      const token = kit.sign(WIRE_CLAIMS, {
        header: { crit: [HINT] },
        custom: { header: { [HINT]: "carried" } },
      });

      expect(JwtKit.decode(token).header.crit).toEqual([HINT]);
      // ⛔ A token aegis mints is a token aegis verifies — for a recipient that takes
      // the parameter on. aegis is never the final recipient, so it refuses until
      // the caller declares it (RFC 7515 §4.1.11).
      expect(() => kit.verify(token)).toThrow(
        expect.objectContaining({ code: "jwt_unsupported_crit_param" }),
      );
      expect(() => kit.verify(token, undefined, { crit: [HINT] })).not.toThrow();
    });

    // ⛔ THE KEYLESS DOOR TOO. `verify` merges the unregistered bag before asking
    // `validateCrit` whether the header carries what its `crit` names; a `parse`
    // asking the registered bag alone would refuse a token aegis just signed.
    test.each(["jwt", "cwt"] as const)(
      "%s: the KEYLESS parse accepts the same token",
      async (wire) => {
        const amphora = new Amphora({
          internal: { issuer: "https://test.lindorm.io/" },
          logger,
        });
        await amphora.setup();
        amphora.add(TEST_EC_KEY_SIG);
        const aegis = new Aegis({ amphora, logger });

        const claims = {
          iss: "https://test.lindorm.io/",
          sub: "user-1",
          exp: 9999999999,
        };

        // The custom bucket is the ONE member the two wires spell differently
        // (`types/header/wire-envelope.ts`), so the bag is built per wire. A shared
        // literal would state a bucket only one arm has.
        const { token } =
          wire === "jwt"
            ? await aegis.jwt.sign(claims, {
                header: { crit: [HINT] },
                custom: { header: { [HINT]: "carried" } },
              })
            : await aegis.cwt.sign(claims, {
                header: { crit: [HINT] },
                custom: { protected: { [HINT]: "carried" } },
              });

        expect(() => aegis.parse(token)).not.toThrow();
      },
    );

    test("the COSE twin mints and verifies the same shape, crit member as a tstr label", () => {
      const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      const token = kit.sign(WIRE_CLAIMS, {
        header: { crit: [HINT] },
        custom: { protected: { [HINT]: "carried" } },
      });

      // `critToCoseLabels` leaves an unregistered member as its own tstr label —
      // asking `coseWireKey` for it would throw for a parameter this very message
      // carries (`internal/utils/token-header.ts`).
      expect(CwtKit.decode(token).protectedHeader.crit).toEqual([HINT]);
      expect(() => kit.verify(token)).toThrow(
        expect.objectContaining({ code: "cwt_unsupported_crit_param" }),
      );
      expect(() => kit.verify(token, undefined, { crit: [HINT] })).not.toThrow();
    });

    // RFC 9052 §3.1.
    //
    // ⛔ THE VERDICT MUST NAME THE REPAIR THE CALLER CAN MAKE. The caller DID write
    // this parameter, so "cannot be marked critical" would send them to remove a
    // legal `crit`; the fault is the BUCKET. The eligibility gate is therefore
    // handed the keys of BOTH custom buckets, so the PLACEMENT rule is the one
    // that answers.
    test("a crit naming ONLY a custom.UNPROTECTED key is refused for its PLACEMENT", () => {
      const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      expect(
        codeOf(() =>
          kit.sign(WIRE_CLAIMS, {
            header: { crit: [HINT] },
            custom: { unprotected: { [HINT]: "advisory" } },
          }),
        ),
      ).toBe("cose_crit_param_unprotected");
    });

    test("a crit naming a key NEITHER custom bucket carries is still not eligible", () => {
      // The other side of the same gate: with no parameter written anywhere, there
      // is no bucket to move it to and "cannot be marked critical" IS the repair.
      const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      expect(codeOf(() => kit.sign(WIRE_CLAIMS, { header: { crit: [HINT] } }))).toBe(
        "cwt_crit_param_not_permitted",
      );
    });

    test("a crit naming a key in BOTH custom buckets is refused for the unprotected copy", () => {
      const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      expect(
        codeOf(() =>
          kit.sign(WIRE_CLAIMS, {
            header: { crit: [HINT] },
            custom: {
              protected: { [HINT]: "signed" },
              unprotected: { [HINT]: "advisory" },
            },
          }),
        ),
      ).toBe("cose_crit_param_unprotected");
    });

    test("a crit naming a key NO bag carries is still refused", () => {
      const kit = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      // The eligibility gate reads the caller's `custom.header` KEYS, so a member
      // naming nothing at all is not permitted either.
      expect(codeOf(() => kit.sign(WIRE_CLAIMS, { header: { crit: [HINT] } }))).toBe(
        "jwt_crit_param_not_permitted",
      );
    });
  });

  /**
   * ⭐ EVERY READ DOOR TAKES THE DECLARATION, INCLUDING THE ENCRYPTED ONES. The
   * sealing doors MINT a critical custom parameter, so a decrypt that could not be
   * told about one would refuse aegis's own output — and `aegis.verify` of a NESTED
   * token runs the crit gate on the OUTER envelope inside that same decrypt
   * (`src/internal/utils/verify-token.ts#decryptOuter`).
   */
  describe("the crit declaration reaches the encrypted doors", () => {
    let amphora: IAmphora;
    let aegis: Aegis;

    beforeEach(async () => {
      const nestedLogger = createMockLogger();
      amphora = new Amphora({
        internal: { issuer: "https://test.lindorm.io/" },
        logger: nestedLogger,
      });
      aegis = new Aegis({ amphora, logger: nestedLogger });

      await amphora.setup();
      amphora.add(TEST_EC_KEY_SIG);
      amphora.add(TEST_EC_KEY_ENC);
    });

    test("JweKit.decrypt refuses its own output until the caller declares", () => {
      const kit = new JweKit({ kryptos: TEST_EC_KEY_ENC, logger });

      const jwe = kit.encrypt("sealed-plaintext", {
        header: { crit: [HINT] },
        custom: { header: { [HINT]: "carried" } },
      });

      expect(() => kit.decrypt(jwe)).toThrow(
        expect.objectContaining({ code: "jwe_unsupported_crit_param" }),
      );
      expect(kit.decrypt<string>(jwe, { crit: [HINT] }).payload).toBe("sealed-plaintext");
    });

    test("CweKit.decrypt refuses its own output until the caller declares", () => {
      const kit = new CweKit({ kryptos: CWE_KEY, logger });

      const cwe = kit.encrypt("sealed-plaintext", {
        header: { crit: [HINT] },
        custom: { protected: { [HINT]: "carried" } },
      });

      expect(() => kit.decrypt(cwe)).toThrow(
        expect.objectContaining({ code: "cwe_unsupported_crit_param" }),
      );
      expect(kit.decrypt<string>(cwe, { crit: [HINT] }).payload).toBe("sealed-plaintext");
    });

    test("aegis.verify carries the declaration into the OUTER peel", async () => {
      const { token: inner } = await aegis.jwt.sign({
        iss: "https://test.lindorm.io/",
        sub: "user-1",
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const { token: outer } = await aegis.jwe.encrypt(inner, {
        // The nested JWT's `cty` (RFC 7519 §5.2); the crit rides beside it on the
        // SAME protected header, which is the envelope the peel gates.
        header: { cty: "JWT", crit: [HINT] },
        custom: { header: { [HINT]: "carried" } },
      });

      await expect(aegis.verify(outer)).rejects.toThrow(
        expect.objectContaining({ code: "jwe_unsupported_crit_param" }),
      );

      const verified = await aegis.verify(outer, undefined, { critical: [HINT] });

      expect(verified.wrapper).toBe("jwe");
      expect(verified.claims.subject).toBe("user-1");
    });
  });

  describe("the tier boundary", () => {
    let amphora: IAmphora;
    let aegis: Aegis;
    let domainLogger: ILogger;

    beforeEach(async () => {
      domainLogger = createMockLogger();
      amphora = new Amphora({
        internal: { issuer: "https://test.lindorm.io/" },
        logger: domainLogger,
      });
      aegis = new Aegis({ amphora, logger: domainLogger });

      await amphora.setup();
      amphora.add(TEST_EC_KEY_SIG);
    });

    // ⛔ UNKNOWNS STOP AT THE WIRE TIER: an unregistered wire parameter has no
    // domain name. TWO gates enforce it (`merge-header-buckets.ts` takes only the
    // two typed buckets by `Pick`; `parseTokenHeader` keeps only what
    // `headerByJose` answers for) and this pins the outcome through the public door.
    test("a custom param the wire carries does NOT reach VerifiedToken.header", async () => {
      const { token } = await aegis.jwt.sign(
        // The AMPHORA's own issuer, so the verify key resolves — this row is
        // about the tier boundary, not about key selection.
        {
          iss: "https://test.lindorm.io/",
          sub: "user-1",
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { custom: { header: { [HINT]: "carried" } } },
      );

      // It IS on the wire — otherwise this row would pass by the parameter never
      // having been written, which proves nothing about the boundary.
      expect(JwtKit.decode(token).custom.header).toEqual({ [HINT]: "carried" });

      const verified = await aegis.verify(token);

      expect(verified.header).not.toHaveProperty(HINT);
      expect(Object.values(verified.header)).not.toContain("carried");
    });

    // ⚠ THE SECOND GATE, PINNED SEPARATELY BECAUSE THE PUBLIC DOOR CANNOT SEE IT:
    // `mergeHeaderBuckets` takes only the two typed buckets (`Pick`), so nothing
    // unregistered reaches the parse through it and a passthrough restored in
    // `parseTokenHeader` would leave the row above green. The parse is asked
    // DIRECTLY here, with a header only a foreign producer could have written.
    test("the wire -> domain parse drops a key no registry row answers for", () => {
      const wire = {
        alg: "ES512",
        typ: "JWT",
        [HINT]: "carried",
      } as unknown as WireTokenHeader;

      const header = domainTokenHeader(
        { protectedHeader: wire, unprotectedHeader: {} },
        "jwt",
      );

      expect(header).not.toHaveProperty(HINT);
      expect(Object.values(header)).not.toContain("carried");
      // The registered members DO cross, so the row cannot pass by the parse
      // having dropped everything.
      expect(header.algorithm).toBe("ES512");
    });
  });
});
