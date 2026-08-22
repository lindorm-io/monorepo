import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { Tag, decodeCbor, encodeCbor } from "../cose/cbor.js";
import { validateCrit } from "../utils/validate-crit.js";
import { writtenHeader } from "./written-header.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const logger = createMockLogger();

const WIRE_CLAIMS = { iss: "https://issuer.lindorm.io/", sub: "user-1" };

/**
 * Rewrite a signed COSE token's PROTECTED bucket, adding raw label/value pairs a
 * foreign producer could have written. The signature is left stale — every row
 * here reads through `decode`, which runs no signature cycle.
 */
const injectProtected = (token: Buffer, entries: Array<[unknown, unknown]>): Buffer => {
  let value: unknown = decodeCbor(token);
  const tags: Array<number> = [];

  while (value instanceof Tag) {
    tags.push(Number(value.tag));
    value = value.contents;
  }

  const structure = [...(value as Array<unknown>)];
  const bucket = decodeCbor(structure[0] as Uint8Array) as Map<unknown, unknown>;

  for (const [label, entry] of entries) bucket.set(label, entry);
  structure[0] = encodeCbor(bucket);

  let wrapped: unknown = structure;
  for (const tag of tags.reverse()) wrapped = new Tag(tag, wrapped);

  return Buffer.from(encodeCbor(wrapped));
};

/** The same, for the UNPROTECTED bucket (element 1 of the structure). */
const injectUnprotected = (token: Buffer, entries: Array<[unknown, unknown]>): Buffer => {
  let value: unknown = decodeCbor(token);
  const tags: Array<number> = [];

  while (value instanceof Tag) {
    tags.push(Number(value.tag));
    value = value.contents;
  }

  const structure = [...(value as Array<unknown>)];
  const bucket = structure[1] as Map<unknown, unknown>;

  for (const [label, entry] of entries) bucket.set(label, entry);

  let wrapped: unknown = structure;
  for (const tag of tags.reverse()) wrapped = new Tag(tag, wrapped);

  return Buffer.from(encodeCbor(wrapped));
};

/**
 * Reading a FOREIGN token's unregistered header parameters.
 *
 * ⚠ A READ CARRIES A CUSTOM PARAM AND NEVER REFUSES ONE. A foreign issuer may
 * write parameters aegis has never heard of, and the issuer is not ours to reject
 * — dropping them hides what the token said, which is the same defect as the typed
 * lie: in both cases a caller cannot tell a parameter that was absent from one
 * that was thrown away.
 *
 * ⛔ AND THEY NEVER JOIN THE TYPED BAGS. `WireTokenHeader` states which keys can
 * exist; a value carrying others under that type is a claim nothing downstream
 * can check.
 *
 * The WRITE half is `custom-header-params.test.ts`.
 */
describe("custom header parameters, on read", () => {
  test("a JOSE header member the registry does not answer for lands in custom.header", () => {
    const kit = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const token = kit.sign(WIRE_CLAIMS);

    const [head, payload, signature] = token.split(".");
    const header = JSON.parse(Buffer.from(head!, "base64url").toString("utf8"));

    const tampered = [
      Buffer.from(
        JSON.stringify({ ...header, "x-foreign": "value", 7: "numeric-key" }),
      ).toString("base64url"),
      payload,
      signature,
    ].join(".");

    const decoded = JwtKit.decode(tampered);

    expect(decoded.custom.header).toEqual({ "x-foreign": "value", 7: "numeric-key" });
    // NOT dropped, and not in the typed bag either.
    expect(decoded.header).not.toHaveProperty("x-foreign");
    // The registered members are untouched — the split moves nothing else.
    expect(decoded.header.alg).toBe("ES512");
    expect(decoded.header.typ).toBe("JWT");
  });

  test("COSE labels the registry does not answer for land in the matching custom bucket", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const token = kit.sign(WIRE_CLAIMS);

    // A tstr label AND an integer one — both forms are labels (RFC 9052 §1.5), and
    // both key the custom bag by `String(label)`.
    const decoded = CwtKit.decode(
      injectUnprotected(
        injectProtected(token, [
          ["x-foreign", "protected-value"],
          [-9999, "integer-label"],
        ]),
        [["x-advisory", "unprotected-value"]],
      ),
    );

    expect(decoded.custom.protected).toEqual({
      "x-foreign": "protected-value",
      "-9999": "integer-label",
    });
    expect(decoded.custom.unprotected).toEqual({ "x-advisory": "unprotected-value" });

    expect(decoded.protectedHeader).not.toHaveProperty("x-foreign");
    expect(decoded.unprotectedHeader).not.toHaveProperty("x-advisory");
  });

  // ⛔ `byCoseName` IS DELIBERATELY NARROW — only the parameters aegis can WRITE
  // under a text label resolve back from one, which is every private-use label
  // and nothing else (`internal/registry/is-private-use-label.ts`). Widening it
  // to "any label may also arrive as its name" would let a foreign token deliver
  // `typ` under a text label aegis never emits: a second spelling for a
  // registered parameter that no specification gives it, and one that would
  // decide token-type routing.
  test("a REGISTERED parameter under a TEXT label aegis never emits does not resolve", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const token = kit.sign(WIRE_CLAIMS, { tokenType: "at" });

    const decoded = CwtKit.decode(
      injectProtected(token, [["typ", "application/hostile+cwt"]]),
    );

    // The kit's OWN `typ`, off integer label 16, is what the typed bag reports.
    expect(decoded.protectedHeader.typ).toBe("application/at+cwt");
    // The text-labelled impostor is carried as what it is — a custom param.
    expect(decoded.custom.protected).toEqual({ typ: "application/hostile+cwt" });
  });

  /**
   * ⛔ THE KEY COMES OFF A TOKEN A STRANGER WROTE, so the ASSIGNMENT that files it
   * is as dangerous as a membership test on it. `JSON.parse` creates `__proto__` as
   * an OWN data property that survives `Object.entries`, and writing it onto a plain
   * `{}` hits `Object.prototype`'s setter instead: the parameter is DROPPED and the
   * bag silently inherits attacker-chosen keys. `Object.create(null)` answers both.
   * This package bans `in` on a caller-influenced key for the same class.
   */
  test("a foreign `__proto__` member is CARRIED as an own key, and pollutes nothing", () => {
    const kit = new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const token = kit.sign(WIRE_CLAIMS);

    const [head, payload, signature] = token.split(".");
    const header = JSON.parse(Buffer.from(head!, "base64url").toString("utf8"));

    const tampered = [
      Buffer.from(
        JSON.stringify({ ...header, ["__proto__"]: { cty: "text/plain" } }),
      ).toString("base64url"),
      payload,
      signature,
    ].join(".");

    const { custom } = JwtKit.decode(tampered);

    // CARRIED: the bag's own contract is that a read never drops what an issuer
    // wrote, and `__proto__` is the one key a plain object cannot hold.
    expect(Object.keys(custom.header)).toEqual(["__proto__"]);
    // NOT POLLUTED: the value did not become the bag's prototype, so nothing a
    // consumer looks up on the bag comes from the attacker.
    expect((custom.header as Record<string, unknown>).cty).toBeUndefined();
    expect(Object.getPrototypeOf(custom.header)).toBeNull();
    // …and no OTHER object in the process inherited it either.
    expect(({} as Record<string, unknown>).cty).toBeUndefined();
  });

  test("the COSE read is the same shape under a hostile TSTR label", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const token = kit.sign(WIRE_CLAIMS);

    const { custom } = CwtKit.decode(
      injectUnprotected(injectProtected(token, [["__proto__", { cty: "text/plain" }]]), [
        ["__proto__", { typ: "application/hostile+cwt" }],
      ]),
    );

    expect(Object.keys(custom.protected)).toEqual(["__proto__"]);
    expect(Object.keys(custom.unprotected)).toEqual(["__proto__"]);
    expect((custom.protected as Record<string, unknown>).cty).toBeUndefined();
    expect((custom.unprotected as Record<string, unknown>).typ).toBeUndefined();
    expect(({} as Record<string, unknown>).cty).toBeUndefined();
  });

  /**
   * ⚠⚠ A KNOWN, DELIBERATE LIMITATION — pinned so it is visible rather than
   * discovered. The integer label `7` and the text label `"7"` are DIFFERENT labels
   * (RFC 9052 §1.5) and CBOR keys them apart, but {@link CoseHeaderBuckets} types
   * the `custom` bag `Record<string, unknown>`, so a bucket carrying both forms
   * yields ONE key.
   *
   * Representing both faithfully means typing {@link CoseHeaderBuckets.custom}
   * `Map<CoseLabel, unknown>` — a change to a PUBLIC read surface, which is why it
   * is not made here. ⚠ It takes a token no aegis writer produces and no sane issuer
   * emits, which is why it is a limitation rather than a defect worth that change.
   */
  test("both label FORMS of one numeral collapse to a single custom key", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const token = kit.sign(WIRE_CLAIMS);

    const decoded = CwtKit.decode(
      injectProtected(token, [
        [-9999, "integer-label"],
        ["-9999", "text-label"],
      ]),
    );

    // ONE key, and the LAST label written wins — CBOR carried two parameters,
    // the bag reports one.
    expect(Object.keys(decoded.custom.protected)).toEqual(["-9999"]);
    expect(decoded.custom.protected["-9999"]).toBe("text-label");
  });

  /**
   * ⛔⛔ A FOREIGN TSTR LABEL MUST NOT SHADOW A REGISTERED PARAMETER.
   *
   * `joseByCose` resolves a tstr label only through `byCoseName`, which holds the
   * private-use parameters alone (`oid` today) — so a bucket carrying the TEXT
   * label `"alg"` or `"crit"` beside the genuine INTEGER labels 1 and 2 puts the
   * foreign spelling in `custom.protected` under a key that collides with the
   * JOSE name of the real one. `String(label)` and a JOSE name share one string
   * space; the two bags are NOT disjoint.
   *
   * ⚠ WHICH MAKES MERGE ORDER A SECURITY PROPERTY, not a formality
   * ({@link writtenHeader}). Read with `custom` last, a stranger appending a text
   * `"crit"` overrides the signed one — and `aegis.parse` checks no signature, so
   * RFC 9052 §3.1's rule can be satisfied by a `crit` the issuer never wrote.
   */
  test("a TSTR label spelled like a registered parameter cannot shadow it", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

    const token = injectProtected(
      kit.sign(WIRE_CLAIMS, { header: { crit: ["oid"], oid: "1.2.3.4" } }),
      [
        ["alg", "HS256"],
        ["crit", ["x-shadow"]],
        ["x-shadow", "v"],
      ],
    );

    const decoded = CwtKit.decode(token);

    // Both spellings survive the read, in their own bags — the custom one is
    // CARRIED, exactly as any other unregistered parameter is.
    expect(decoded.protectedHeader.alg).toBe("ES512");
    expect(decoded.custom.protected.alg).toBe("HS256");

    // ⛔ …and the REGISTERED one is what the merged view reports.
    const merged = writtenHeader(
      decoded.protectedHeader as unknown as Record<string, unknown>,
      decoded.custom.protected,
    );

    expect(merged.alg).toBe("ES512");
    expect(merged.crit).toEqual(["oid"]);
  });

  /**
   * ⛔ THE COLLISION'S NAMED CONSEQUENCE, pinned so the limitation cannot silently
   * widen. The crit here names the INTEGER label 7 while only the TSTR `"7"` is
   * present — different labels — but both reduce to the string `"7"` in the merged
   * view, so the presence test passes and RFC 9052 §3.1's fatal condition goes
   * unraised.
   *
   * ⚠ THE ROW ASSERTS THE LIMITATION, NOT A DESIRED BEHAVIOUR. It goes red the day
   * the bag is typed `Map<CoseLabel, unknown>` and the two labels stop colliding —
   * which is the fix, and the point of the row is that the fix must be a deliberate
   * change rather than a silent one.
   */
  test("an INTEGER crit member is satisfied by a TSTR parameter of the same numeral", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

    const decoded = CwtKit.decode(
      injectProtected(kit.sign(WIRE_CLAIMS), [
        [2, [7]],
        ["7", "v"],
      ]),
    );

    // The two labels reduce to one string on the way out…
    expect(decoded.protectedHeader.crit).toEqual(["7"]);
    expect(decoded.custom.protected["7"]).toBe("v");

    // …so the header AS WRITTEN carries a `"7"` the crit can name, and the
    // malformed-crit gate finds nothing to refuse. Were the labels kept apart,
    // `validateCrit` would report the missing parameter.
    expect(
      validateCrit(
        writtenHeader(
          decoded.protectedHeader as unknown as Record<string, unknown>,
          decoded.custom.protected,
        ),
      ),
    ).toBeNull();
  });

  /**
   * ⛔ THE VALUE TYPE IS `unknown` AND STAYS THAT WAY, which is what lets a read
   * report the wire rather than a normalisation of it. A nested custom value is a
   * CBOR map on COSE and a JSON object on JOSE, and each decoder hands back the
   * shape its wire carries. Converting either way would invent a structure on one
   * wire or destroy label fidelity on the other (RFC 9052 §1.5).
   *
   * ⚠ A consumer therefore branches on the SHAPE, exactly as it would reading the
   * raw wire. The reasoning lives on the type
   * (`src/types/header/wire-buckets.ts#export type CoseHeaderBuckets`); this is
   * the row that makes it fail if the decoders ever agree.
   */
  test("a nested CBOR map survives as a Map, and its JOSE twin as a plain object", () => {
    // ONE logical input, written through both public mint doors.
    const nested = { k: "v" };

    const cose = CwtKit.decode(
      new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(WIRE_CLAIMS, {
        custom: { protected: { "x-nested": nested } },
      }),
    ).custom.protected["x-nested"];

    const jose = JwtKit.decode(
      new JwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(WIRE_CLAIMS, {
        custom: { header: { "x-nested": nested } },
      }),
    ).custom.header["x-nested"];

    expect(cose).toBeInstanceOf(Map);
    expect([...(cose as Map<unknown, unknown>).entries()]).toEqual([["k", "v"]]);

    expect(jose).not.toBeInstanceOf(Map);
    expect(jose).toEqual({ k: "v" });
  });

  test("`oid` DOES resolve from its text label, because that is a label aegis writes", () => {
    // The other side of the same rule, and what keeps it from being "text labels
    // never resolve": `oid` has no IANA COSE parameter, so it rides a lindorm
    // private-use label and the interoperable default spells it as the string.
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

    const decoded = CwtKit.decode(kit.sign(WIRE_CLAIMS, { header: { oid: "1.2.3.4" } }));

    expect(decoded.protectedHeader.oid).toBe("1.2.3.4");
    expect(decoded.custom.protected).toEqual({});
  });
});
