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
 * ⚠ A READ CARRIES AN UNKNOWN AND NEVER REFUSES ONE. A foreign issuer may write
 * parameters aegis has never heard of, and the issuer is not ours to reject —
 * dropping them hides what the token said, which is the same defect as the typed
 * lie: in both cases a caller cannot tell a parameter that was absent from one
 * that was thrown away.
 *
 * ⛔ AND THEY NEVER JOIN THE TYPED BAGS. `WireTokenHeader` states which keys can
 * exist; a value carrying others under that type is a claim nothing downstream
 * can check.
 */
describe("unknown header parameters, on read", () => {
  test("a JOSE header member the registry does not answer for lands in unknown.protected", () => {
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

    expect(decoded.unknown.protected).toEqual({ "x-foreign": "value", 7: "numeric-key" });
    // NOT dropped, and not in the typed bag either.
    expect(decoded.protectedHeader).not.toHaveProperty("x-foreign");
    // The registered members are untouched — the split moves nothing else.
    expect(decoded.protectedHeader.alg).toBe("ES512");
    expect(decoded.protectedHeader.typ).toBe("JWT");
  });

  test("COSE labels the registry does not answer for land in the matching unknown bucket", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const token = kit.sign(WIRE_CLAIMS);

    // A tstr label AND an integer one — RFC 9052 §1.4 admits both forms, and both
    // key the unknown bag by `String(label)`.
    const decoded = CwtKit.decode(
      injectUnprotected(
        injectProtected(token, [
          ["x-foreign", "protected-value"],
          [-9999, "integer-label"],
        ]),
        [["x-advisory", "unprotected-value"]],
      ),
    );

    expect(decoded.unknown.protected).toEqual({
      "x-foreign": "protected-value",
      "-9999": "integer-label",
    });
    expect(decoded.unknown.unprotected).toEqual({ "x-advisory": "unprotected-value" });

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
    // The text-labelled impostor is carried as what it is — an unknown.
    expect(decoded.unknown.protected).toEqual({ typ: "application/hostile+cwt" });
  });

  /**
   * ⛔ THE KEY COMES OFF A TOKEN A STRANGER WROTE, so the ASSIGNMENT that files it
   * is as dangerous as a membership test on it. `JSON.parse` creates `__proto__`
   * as an OWN data property — it survives `Object.entries` — and writing it onto a
   * plain `{}` hits `Object.prototype`'s setter instead: the parameter is DROPPED
   * (breaking the verbatim-carriage contract this bag states) and the bag silently
   * inherits attacker-chosen keys. `Object.create(null)` answers both at once.
   *
   * This package already bans `in` on a caller-influenced key for the same class;
   * the write side is the half that had no rule.
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

    const { unknown } = JwtKit.decode(tampered);

    // CARRIED: the bag's own contract is that a read never drops what an issuer
    // wrote, and `__proto__` is the one key a plain object cannot hold.
    expect(Object.keys(unknown.protected)).toEqual(["__proto__"]);
    // NOT POLLUTED: the value did not become the bag's prototype, so nothing a
    // consumer looks up on the bag comes from the attacker.
    expect((unknown.protected as Record<string, unknown>).cty).toBeUndefined();
    expect(Object.getPrototypeOf(unknown.protected)).toBeNull();
    // …and no OTHER object in the process inherited it either.
    expect(({} as Record<string, unknown>).cty).toBeUndefined();
  });

  test("the COSE read is the same shape under a hostile TSTR label", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });
    const token = kit.sign(WIRE_CLAIMS);

    const { unknown } = CwtKit.decode(
      injectUnprotected(injectProtected(token, [["__proto__", { cty: "text/plain" }]]), [
        ["__proto__", { typ: "application/hostile+cwt" }],
      ]),
    );

    expect(Object.keys(unknown.protected)).toEqual(["__proto__"]);
    expect(Object.keys(unknown.unprotected)).toEqual(["__proto__"]);
    expect((unknown.protected as Record<string, unknown>).cty).toBeUndefined();
    expect((unknown.unprotected as Record<string, unknown>).typ).toBeUndefined();
    expect(({} as Record<string, unknown>).cty).toBeUndefined();
  });

  /**
   * ⚠⚠ A KNOWN, DELIBERATE LIMITATION — pinned so it is visible rather than
   * discovered. RFC 9052 §1.4 makes the integer label `7` and the text label
   * `"7"` DIFFERENT labels, and CBOR keys them apart; this package states that
   * rule elsewhere in as many words (`scenarios.ts#WireKey`). The `unknown` bag
   * cannot honour it: {@link WireHeaderBuckets} types it as
   * `Record<string, unknown>`, so an integer label can only be reported under its
   * decimal spelling and a bucket carrying both forms yields ONE key.
   *
   * Representing both faithfully needs {@link WireHeaderBuckets.unknown} typed
   * `Map<CoseLabel, unknown>` rather than `Record<string, unknown>` — a change to
   * a PUBLIC read surface, which is why it is not made here. The collision is
   * stated rather than hidden: a token carrying both forms of the same numeral
   * loses one, and this row says which.
   *
   * ⚠ It needs a token no aegis writer produces and no sane issuer emits, which
   * is why it is a limitation rather than a defect worth a surface change.
   */
  test("both label FORMS of one numeral collapse to a single unknown key", () => {
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
    expect(Object.keys(decoded.unknown.protected)).toEqual(["-9999"]);
    expect(decoded.unknown.protected["-9999"]).toBe("text-label");
  });

  /**
   * ⛔⛔ A FOREIGN TSTR LABEL MUST NOT SHADOW A REGISTERED PARAMETER.
   *
   * `joseByCose` resolves a tstr label only through `byCoseName`, which holds the
   * private-use parameters alone (`oid` today) — so a bucket carrying the TEXT
   * label `"alg"` or `"crit"` beside the genuine INTEGER labels 1 and 2 puts the
   * foreign spelling in `unknown.protected` under a key that collides with the
   * JOSE name of the real one. `String(label)` and a JOSE name share one string
   * space; the two bags are NOT disjoint.
   *
   * ⚠ WHICH MAKES MERGE ORDER A SECURITY PROPERTY, not a formality
   * ({@link writtenHeader}). Read with `unknown` last, a stranger appending a text
   * `"crit"` overrides the signed one — and `aegis.parse` checks no signature at
   * all, so RFC 9052 §3.1's fatal-error rule can be satisfied by a `crit` the
   * issuer never wrote.
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

    // Both spellings survive the read, in their own bags — the unknown one is
    // CARRIED, exactly as any other unregistered parameter is.
    expect(decoded.protectedHeader.alg).toBe("ES512");
    expect(decoded.unknown.protected.alg).toBe("HS256");

    // ⛔ …and the REGISTERED one is what the merged view reports.
    const merged = writtenHeader(
      decoded.protectedHeader as unknown as Record<string, unknown>,
      decoded.unknown.protected,
    );

    expect(merged.alg).toBe("ES512");
    expect(merged.crit).toEqual(["oid"]);
  });

  /**
   * ⛔ THE COLLISION'S NAMED CONSEQUENCE, pinned so the limitation cannot silently
   * widen. RFC 9052 §3.1 makes a `crit` label whose parameter is NOT in the
   * protected bucket a FATAL error. Here the crit names the INTEGER label 7 and
   * only the TSTR `"7"` is present — different labels — but both reduce to the
   * string `"7"` in the merged view, so the presence test passes and the fatal
   * condition goes unraised.
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
    expect(decoded.unknown.protected["7"]).toBe("v");

    // …so the header AS WRITTEN carries a `"7"` the crit can name, and the
    // malformed-crit gate finds nothing to refuse. Were the labels kept apart,
    // `validateCrit` would report the missing parameter.
    expect(
      validateCrit(
        writtenHeader(
          decoded.protectedHeader as unknown as Record<string, unknown>,
          decoded.unknown.protected,
        ),
      ),
    ).toBeNull();
  });

  test("`oid` DOES resolve from its text label, because that is a label aegis writes", () => {
    // The other side of the same rule, and what keeps it from being "text labels
    // never resolve": `oid` has no IANA COSE parameter, so it rides a lindorm
    // private-use label and the interoperable default spells it as the string.
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

    const decoded = CwtKit.decode(kit.sign(WIRE_CLAIMS, { header: { oid: "1.2.3.4" } }));

    expect(decoded.protectedHeader.oid).toBe("1.2.3.4");
    expect(decoded.unknown.protected).toEqual({});
  });
});
