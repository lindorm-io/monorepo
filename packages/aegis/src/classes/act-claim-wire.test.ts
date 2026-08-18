import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeAll, describe, expect, test } from "vitest";
import { inspectToken } from "../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

/**
 * WHAT AN `act` / `may_act` CHAIN ACTUALLY SAYS ON EACH WIRE.
 *
 * RFC 8693 §4.1 defines the actor claim by its members and by its NESTING — "A
 * chain of delegation can be expressed by nesting one 'act' claim within another.
 * The outermost 'act' claim represents the current actor while nested 'act'
 * claims represent prior actors." — so the member spellings AND the nesting are
 * the interoperability contract. A token spelling `subject` instead of `sub`, or
 * flattening the chain, would round-trip through this package perfectly and mean
 * nothing to anyone else.
 *
 * ⚠ EVERY ASSERTION HERE GOES THROUGH THE INDEPENDENT INSPECTOR
 * (`__fixtures__/inspect-token.ts` — raw `cbor2` and base64url, importing nothing
 * from `src/internal/` or `src/classes/`). Reading the token back through aegis's
 * own decoder proves only that the writer and the reader agree, which a pair of
 * mirrored bugs satisfies exactly.
 *
 * ⚠⚠ WHAT WAS MEASURED BEFORE THIS FILE, and it is why the file exists: `act` had
 * ONE wire-level pin, a COSE-only one in `classes/cose-claims-encoding.test.ts`,
 * and `may_act` had NONE ON EITHER WIRE — no scenario row, no byte pin, no claim
 * label pin. So a claim with an integer COSE label and a compact/interoperable
 * duality was carried entirely by round trips through the package's own decoder.
 *
 * ⛔ THE EXPECTED SPELLINGS AND LABELS BELOW ARE WRITTEN OUT, NOT READ FROM THE
 * REGISTRY. A test that derives them from `act-members.ts` agrees with whatever
 * the registry currently says — including a wrong label — so it could state that
 * the wire matches the registry but never that the wire matches RFC 8693.
 */

// Inside the fixture keys' validity window — amphora refuses an expired key.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/** A three-deep chain in the DOMAIN vocabulary, every value distinct. */
const ACTOR_CHAIN = {
  subject: "service-1",
  issuer: "https://issuer-1.lindorm.test",
  audience: ["https://rs-1.lindorm.test"],
  clientId: "client-1",
  act: {
    subject: "service-2",
    clientId: "client-2",
    act: { subject: "service-3" },
  },
};

/** The same chain in the WIRE vocabulary. Written out — see the file docstring. */
const WIRE_ACTOR_CHAIN: Dict = {
  sub: "service-1",
  iss: "https://issuer-1.lindorm.test",
  aud: ["https://rs-1.lindorm.test"],
  client_id: "client-1",
  act: {
    sub: "service-2",
    client_id: "client-2",
    act: { sub: "service-3" },
  },
};

/**
 * The COSE labels the actor MEMBERS carry, written out rather than derived.
 *
 * RFC 8392 §4 registers the first three at CLAIM level — "iss | 1", "sub | 2",
 * "aud | 3" — and the actor map reuses them so a compact actor speaks the CWT
 * vocabulary. `client_id` (4) and the nested `act` (5) have no COSE registration
 * anywhere and are LINDORM's own, which is exactly why the compact form is
 * on-platform only.
 */
const ISS = 1;
const SUB = 2;
const AUD = 3;
const CLIENT_ID = 4;
const ACT = 5;

/**
 * The lindorm private-use COSE label the `may_act` CLAIM carries.
 *
 * ⚠ THE CLAIM KEY AND THE MEMBER KEYS ARE DIFFERENT QUESTIONS, and `act` and
 * `may_act` answer the first one differently: `act` is short enough that its
 * string name is the smaller encoding, so it is text-keyed on COSE in both modes,
 * while `may_act` carries this integer and degrades to the string `may_act` for
 * an interoperable token. RFC 8392 §9.1.1 is the registry that governs a CWT
 * CLAIM KEY — "Integer values less than -65536 are marked as Private Use" — so a
 * token carrying one is meaningless to any reader but us. (RFC 8152 §16.2 says
 * the same of a COSE HEADER PARAMETER, which is a different registry and not the
 * one a claim key comes from.) Their MEMBERS are keyed identically, because they
 * share one declaration.
 */
const MAY_ACT_COSE_LABEL = -65543;

const logger = createMockLogger();

let aegis: Aegis;

beforeAll(async () => {
  const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

  await amphora.setup();
  amphora.add(TEST_EC_KEY_SIG);

  aegis = new Aegis({ amphora, logger });
});

const mint = async (
  format: "jwt" | "cwt",
  content: Dict,
  proprietary?: true,
): Promise<string> => {
  const signed = await aegis.mint(
    "default",
    { subject: "user-1", expires: "1h", ...content } as never,
    {
      format,
      proprietary,
      sign: { key: { kryptos: TEST_EC_KEY_SIG }, tokenId: "act-wire-1" },
    },
  );

  return signed.token;
};

/**
 * The raw claim value a token carries, in the wire's own vocabulary.
 *
 * THROWS rather than returning `undefined` for a payload it cannot read or a
 * claim that is not there: every assertion below is an equality over this value,
 * and an equality against `undefined` that was meant to run against a structure
 * is the vacuous pass the inspector exists to prevent.
 */
const wireClaimOf = (token: string, key: number | string): unknown => {
  const inspection = inspectToken(token);

  if (inspection.payload.readable === false) {
    throw new Error(`the payload cannot be read: ${inspection.payload.reason}`);
  }

  const claims = inspection.payload.value;
  const value =
    inspection.wire === "jose"
      ? (claims as Dict)[String(key)]
      : (claims as ReadonlyMap<number | string, unknown>).get(key);

  if (value === undefined) {
    throw new Error(`the token carries no claim under ${String(key)}`);
  }

  return value;
};

/**
 * A COSE actor map rendered to plain objects — for the INTEROPERABLE form alone,
 * where every key is a string.
 *
 * ⛔ It is deliberately NOT used for the compact form. `Object.fromEntries`
 * stringifies an integer key, so a member that arrived under the text `"2"` would
 * compare equal to one under the integer `2`. RFC 9052 §1.5 admits BOTH forms —
 * "In COSE, we use text strings, negative integers, and unsigned integers as map
 * keys", grammar `label = int / tstr` — and it is CBOR's data model, where a map
 * key's type is part of the key, that keeps them apart. (§1.5 itself states the
 * admissibility, not the distinctness.) The compact assertions therefore compare
 * `Map` against `Map`, which preserves the key's type.
 */
const plain = (value: unknown): unknown =>
  value instanceof Map
    ? Object.fromEntries([...value].map(([key, inner]) => [key, plain(inner)]))
    : value;

describe("the act / may_act claims on the wire", () => {
  test("a JOSE token spells every actor member the way RFC 8693 does, at every depth", async () => {
    const token = await mint("jwt", { act: ACTOR_CHAIN });

    // Whole-value equality, not a subset: a subset match passes over a member
    // the token dropped, and dropping a member is the failure mode a declared
    // member set exists to prevent. It reaches all three levels, so a translator
    // that stopped recursing below the first shows up here.
    expect(wireClaimOf(token, "act")).toEqual(WIRE_ACTOR_CHAIN);
  });

  test("a JOSE token spells `may_act` from the SAME member declaration", async () => {
    const token = await mint("jwt", { mayAct: ACTOR_CHAIN });

    // RFC 8693 §4.4 describes `may_act` in the words §4.1 uses for `act`, and the
    // registry declares ONE member set for both. Asserted separately rather than
    // inferred: the two claims are two registry entries, and "they agree" is the
    // fact worth being able to see break.
    expect(wireClaimOf(token, "may_act")).toEqual(WIRE_ACTOR_CHAIN);
  });

  test("a JOSE token keeps the actor members in the order the caller wrote them", async () => {
    // JSON preserves insertion order, so this IS a statement about the bytes: a
    // translator that walked its member DECLARATION instead of the caller's value
    // would re-order every actor and move bytes on a signed wire while every
    // round trip still agreed with itself.
    const token = await mint("jwt", {
      act: { clientId: "client-1", subject: "service-1", issuer: "https://i.test" },
    });

    expect(Object.keys(wireClaimOf(token, "act") as Dict)).toEqual([
      "client_id",
      "sub",
      "iss",
    ]);
  });

  test("an INTEROPERABLE COSE token keys the actor members by their RFC 8693 names", async () => {
    const token = await mint("cwt", { act: ACTOR_CHAIN });

    // Two of the actor labels — `client_id` 4 and the nested `act` 5 — are
    // registered in no COSE or CWT registry at all, so an interoperable token
    // must not carry them: the actor map is string-keyed all the way down, with
    // the same spellings the JOSE token uses.
    expect(plain(wireClaimOf(token, "act"))).toEqual(WIRE_ACTOR_CHAIN);
  });

  test("an INTEROPERABLE COSE token keys `may_act` by its STRING name, not its label", async () => {
    const token = await mint("cwt", { mayAct: ACTOR_CHAIN });
    const inspection = inspectToken(token);

    if (inspection.wire !== "cose" || inspection.payload.readable === false) {
      throw new Error("the mint did not produce a readable COSE payload");
    }

    // The claim key and the member keys are two questions, and this row is the
    // first: a private-use integer is meaningless to any reader but us.
    expect(inspection.payload.value.has("may_act")).toBe(true);
    expect(inspection.payload.value.has(MAY_ACT_COSE_LABEL)).toBe(false);
    expect(plain(wireClaimOf(token, "may_act"))).toEqual(WIRE_ACTOR_CHAIN);
  });

  test("a PROPRIETARY COSE token collapses the actor to integer members, at every depth", async () => {
    const token = await mint("cwt", { act: ACTOR_CHAIN }, true);

    // ⭐ THE RECURSION PROOF ON THE WIRE. Three levels, `Map` against `Map` so an
    // integer label cannot compare equal to its own text spelling. A compaction
    // that reached only the top level would leave the two prior actors
    // string-keyed inside an integer-keyed parent — and every read through this
    // package would agree with itself about it.
    expect(wireClaimOf(token, "act")).toEqual(
      new Map<number, unknown>([
        [SUB, "service-1"],
        [ISS, "https://issuer-1.lindorm.test"],
        [AUD, ["https://rs-1.lindorm.test"]],
        [CLIENT_ID, "client-1"],
        [
          ACT,
          new Map<number, unknown>([
            [SUB, "service-2"],
            [CLIENT_ID, "client-2"],
            [ACT, new Map<number, unknown>([[SUB, "service-3"]])],
          ]),
        ],
      ]),
    );
  });

  test("a PROPRIETARY COSE token moves the `may_act` CLAIM to its private-use label", async () => {
    const token = await mint("cwt", { mayAct: ACTOR_CHAIN }, true);

    // Both halves of the claim's duality in one row: the claim moves to its
    // integer label AND its members collapse — asserted at the label, so a token
    // that compacted the members while leaving the claim string-keyed throws in
    // `wireClaimOf` rather than passing.
    expect(wireClaimOf(token, MAY_ACT_COSE_LABEL)).toEqual(
      new Map<number, unknown>([
        [SUB, "service-1"],
        [ISS, "https://issuer-1.lindorm.test"],
        [AUD, ["https://rs-1.lindorm.test"]],
        [CLIENT_ID, "client-1"],
        [
          ACT,
          new Map<number, unknown>([
            [SUB, "service-2"],
            [CLIENT_ID, "client-2"],
            [ACT, new Map<number, unknown>([[SUB, "service-3"]])],
          ]),
        ],
      ]),
    );
  });

  test("an actor member aegis does not declare rides UNTOUCHED on both wires, at depth", async () => {
    // RFC 8693 §4.1 leaves the actor's member set open, and §4.4 names `email` as
    // an example. The member is carried VERBATIM — a case flip would rewrite a
    // name another specification chose — and it is asserted at DEPTH because a
    // tail policy declared on the claim and forgotten on the nested member would
    // pass a depth-1 row and refuse this one. (That was live for one measurement:
    // `open` sits on the CODEC, and the nested `act` member declares its own.)
    const chain = {
      subject: "service-1",
      registeredBy: "https://scheme.example.test",
      act: { subject: "service-2", email: "service-2@example.test" },
    };

    for (const format of ["jwt", "cwt"] as const) {
      const token = await mint(format, { act: chain });

      expect({ format, act: plain(wireClaimOf(token, "act")) }).toEqual({
        format,
        act: {
          sub: "service-1",
          registeredBy: "https://scheme.example.test",
          act: { sub: "service-2", email: "service-2@example.test" },
        },
      });
    }
  });

  test("the compact COSE encoding keeps an undeclared member instead of dropping it", async () => {
    // ⚠⚠ THE PER-MODE DATA LOSS THIS EXISTS FOR. A label map built by walking the
    // LABEL TABLE holds only the members the table names, so an undeclared one
    // vanished from a signed token in `proprietary` mode while the interoperable
    // encoding of the same claim kept it — one domain call, two encodings, two
    // different statements, and the smaller token is the one a deployment turns on.
    //
    // RFC 9052 §1.5 is what makes the honest encoding available: "In COSE, we use
    // text strings, negative integers, and unsigned integers as map keys", grammar
    // `label = int / tstr`. So the map is MIXED — declared members under their
    // integers, the tail under its own name — and asserting both halves in one
    // `Map` is what stops an encoder that gave up and emitted the string-keyed
    // structure wholesale from passing.
    const token = await mint(
      "cwt",
      { act: { subject: "service-1", email: "service-1@example.test" } },
      true,
    );

    expect(wireClaimOf(token, "act")).toEqual(
      new Map<number | string, unknown>([
        [SUB, "service-1"],
        ["email", "service-1@example.test"],
      ]),
    );
  });

  test("a member spelled twice is refused even when the DECLARED one is unusable", async () => {
    // ⛔⛔ THE ATTACK THE FIRST VERSION OF THE COLLISION GUARD LEFT OPEN. That
    // version registered the key inside the write — after translation and after
    // the emptiness prune — so a declared member whose value FAILED ITS OWN CODEC
    // vacated its slot in silence and the look-alike walked into it. Measured on
    // that version: `{ subject: 42, sub: "shadow" }` minted `act: {"sub":"shadow"}`
    // with no refusal, on both wires and in both COSE modes.
    for (const format of ["jwt", "cwt"] as const) {
      await expect(
        mint(format, { act: { subject: 42, sub: "shadow-actor" } }),
        format,
      ).rejects.toMatchObject({
        code: "claim_structure_invalid",
        data: {
          claim: "act",
          invalid: [
            {
              key: "act.sub",
              message: 'Members "sub" and "subject" both resolve to "sub" in "act"',
            },
          ],
        },
      });
    }

    // ⚠ THE ABSENT FORM IS ASSERTED AT THE VOCABULARY DOOR, NOT THROUGH `mint`,
    // and the reason is a fact about a DIFFERENT package. `mint` normalises the
    // claim bag before the translator runs, and `@lindorm/utils`'s
    // `omitFromObject` recurses into the actor and strips an explicitly
    // `undefined` member — so the walker never sees the key that was named.
    // Measured: `mint("default", { act: { subject: undefined, sub: "shadow" } })`
    // succeeds. `Aegis.toWire` runs no normalisation, so it is where this half of
    // the rule is observable, and the rule itself is the same one: a member that
    // NAMED a key holds it whether or not a value ever arrives.
    expect(() =>
      Aegis.toWire({ act: { subject: undefined, sub: "shadow-actor" } } as never),
    ).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }) as unknown as Error,
    );
  });

  test("a member name drawn from Object.prototype is carried, not resolved through it", async () => {
    // ⛔⛔ AN UNAUTHENTICATED CRASH IF THE LOOKUP WALKS THE PROTOTYPE CHAIN. The
    // compact COSE encoder resolves a member's nested spec by name, and an OPEN
    // member set makes `toString` / `constructor` / `valueOf` legal member names —
    // so `spec.nested?.[field]` resolved them to `Object.prototype`'s own members
    // and `nested.spec()` threw a bare `TypeError`. `aegis.parse` reads a payload
    // BEFORE any signature is checked, so a hostile token crashed the reader.
    //
    // Asserted as a ROUND TRIP through the compact encoding: not throwing is the
    // minimum, and carrying the member is the actual contract.
    for (const name of ["toString", "constructor", "valueOf", "hasOwnProperty"]) {
      const token = await mint("cwt", { act: { subject: "s", [name]: "x" } }, true);
      const verified = await aegis.verify(token);

      expect({ name, act: verified.claims.act }).toEqual({
        name,
        act: { subject: "s", [name]: "x" },
      });
    }
  });

  /**
   * ⭐ THE COMPACT-COSE `__proto__` PIN NOW LIVES IN THE SPECIFICATION, as the
   * conformance row `a-compact-cose-member-map-refuses-a-text-__proto__-label`.
   * The `forged` GIVEN states the member map as key/keyedBy/value rows, which is
   * the shape a JS object cannot hold, so the table can finally arbitrate it.
   * ⚠ Re-measured on the final tree before this one was deleted: rewriting
   * `internal/cose/compact-map.ts`'s `Object.defineProperty` to
   * `obj[field] = decoded` reddens that row with the refusal replaced by
   * `Claim "act" must be an object` — the own key was never created.
   */

  test("a `__proto__` member is refused at BOTH STATIC VOCABULARY DOORS", () => {
    // ⛔⛔ `__proto__` is a legal JSON member name that ASSIGNMENT treats as a
    // prototype setter, so a claim carrying one produced a value whose
    // `Object.keys` and `JSON.stringify` showed it as absent while
    // `claims.act.subject` returned the attacker's value — data a consumer's
    // natural read returns and every audit log renders as missing. The collision
    // guard cannot see it either: no own key is created, so nothing is claimed
    // twice.
    //
    // ⭐ THE TOKEN DOOR IS NOW IN THE SPECIFICATION, as the conformance row
    // `a-structured-member-named-__proto__-is-refused-rather-than-made-a-prototype`
    // — a forged JOSE token read at the KEYLESS `parse` door, which is the real
    // threat model (a payload is reported without a signature check, so the
    // attacker needs no key). What stays here is what a ROW CANNOT STATE: these
    // TABLE HAS NO STEP FOR THESE DOORS AT ALL. Every verb a row may name:
    // `accepts` `bucket` `claims` `clock` `custom` `decrypt` `deployment` `dpop`
    // `header` `keys` `kit-verify` `mint` `parse` `profile` `raw` `rejects`
    // `static-assert` `token` `untranslatedClaims` `verify` `wireClaims`
    // `wirePayload` `wireProtectedHeader` `wireStructure` `wireUnprotectedHeader`
    // — 25 of them (`grep -oE 'step: "[a-zA-Z-]+"' src/__fixtures__/scenarios.ts
    // | sort -u`), and neither `Aegis.toDomain` nor `Aegis.toWire` is among them;
    // `run-scenario.ts` never calls either, and `static-assert` is
    // `Aegis.matches`/`Aegis.assert`, a different surface.
    //
    // ⚠ AN EARLIER VERSION OF THIS NOTE GAVE A DIFFERENT AND FALSE REASON — that
    // a row could not hold the input because an object literal invokes the
    // prototype setter, so `JSON.parse` was the only way to build one. Measured
    // in node: a COMPUTED key does create a real own property, and only the plain
    // literal form does not.
    //   `{ ["__proto__"]: { x: 1 } }` → hasOwn true,  keys ["__proto__"]
    //   `{ __proto__: { x: 1 } }`     → hasOwn false, keys []
    // So a row COULD carry the value. What it cannot do is name a door.
    expect(() =>
      Aegis.toDomain(JSON.parse('{"act":{"__proto__":{"subject":"attacker"}}}')),
    ).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }) as unknown as Error,
    );
    expect(() => Aegis.toWire(JSON.parse('{"act":{"__proto__":{"sub":"x"}}}'))).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }) as unknown as Error,
    );
  });

  test("a member the caller spelled twice is refused rather than resolved by key order", async () => {
    // The declared `subject` resolves to the wire `sub`; a caller-supplied `sub`
    // rides the open tail and lands on the same key. Refused at the emission
    // boundary — the last moment the value is still the producer's to correct —
    // and the message names the PAIR in a stable order, because which of the two
    // arrives second is decided by key order and the two wires do not agree.
    for (const format of ["jwt", "cwt"] as const) {
      await expect(
        mint(format, { act: { subject: "declared-actor", sub: "shadow-actor" } }),
      ).rejects.toMatchObject({
        code: "claim_structure_invalid",
        data: {
          claim: "act",
          invalid: [
            {
              key: "act.sub",
              message: 'Members "sub" and "subject" both resolve to "sub" in "act"',
            },
          ],
        },
      });
    }
  });

  test("an actor member value that is not of its declared kind never reaches the wire", async () => {
    // The symmetry the wire is the only witness to: a writer that emitted
    // `sub: 42` would sign a token asserting it while this package's own reader
    // reported that member as never stated. Whole-value equality on the RAW wire,
    // because a round trip cannot see the difference between a member that was
    // never written and one the reader discarded.
    for (const format of ["jwt", "cwt"] as const) {
      const token = await mint(format, {
        act: { subject: "service-1", issuer: 42 },
      });

      expect({ format, act: plain(wireClaimOf(token, "act")) }).toEqual({
        format,
        act: { sub: "service-1" },
      });
    }
  });

  test("a CWT AEGIS ITSELF WROTE with one member keyed twice is refused at the KEYLESS door", async () => {
    // ⛔⛔ THE COSE-ONLY COLLISION. RFC 9052 §1.5 makes the integer label and the
    // interoperable text name different map keys ("In COSE, we use text strings,
    // negative integers, and unsigned integers as map keys", grammar
    // `label = int / tstr`) — but they are two renderings of ONE declared member,
    // so a map carrying both said two things about one field and the LAST one
    // won, silently. Measured before the fix: `act` as
    // `Map { 2 => "audited-service", "sub" => "rogue-service" }` read back as
    // `{ subject: "rogue-service" }`, replacing the actor the issuer named.
    //
    // ⭐ THE VERIFYING DOOR IS NOW IN THE SPECIFICATION, as the conformance row
    // `a-cwt-keying-one-member-by-both-its-label-and-its-name-is-refused` — a
    // hand-forged CWT carrying a real signature, so the refusal is proven to come
    // from the claims decoder and not from anything upstream of it.
    //
    // ⚠ TWO THINGS KEEP THIS ONE ALIVE, and neither is a copy of that row.
    //   1. THE DOOR. A row asserts ONE act's outcome, and `parse` is the door that
    //      reports a payload WITHOUT checking a signature — a different reach, so
    //      it is a separate statement rather than the same one twice.
    //   2. THE PROVENANCE. The forged row assembles the map itself; here AEGIS'S
    //      OWN WRITER produces it, because a `Map` value rides the interoperable
    //      arm verbatim into CBOR. So this says the hazardous shape is reachable
    //      through this package's own sign door, which no forgery can show.
    //
    // ⚠ THE UNIT PIN IS IN `internal/cose/compact-map.test.ts`; this one exists
    // because that one cannot see the ROUTING. `internal/cose/cwt-spec.ts` gates
    // the compact ENCODE on `proprietary` and leaves DECODE ungated, which is what
    // makes any mixed map reach the walker — a fact only an end-to-end token shows.
    const signed = await aegis.cwt.sign(
      {
        iss: ISSUER,
        sub: "user-1",
        exp: Math.floor(Date.now() / 1000) + 3600,
        act: new Map<number | string, unknown>([
          [2, "audited-service"],
          ["sub", "rogue-service"],
        ]),
      } as never,
      { key: { kryptos: TEST_EC_KEY_SIG } } as never,
    );

    expect(() => aegis.parse(signed.token)).toThrow(
      expect.objectContaining({
        code: "cose_duplicate_member_key",
        data: { claim: "act", member: "sub", label: 2, key: "sub" },
      }) as unknown as Error,
    );
  });
});
