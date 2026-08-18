import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeAll, describe, expect, test } from "vitest";
import { encode, Tag } from "cbor2";
import { CBOR_TAG, inspectToken } from "../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

/**
 * WHAT AN RFC 8417 `events` MAP ACTUALLY SAYS ON EACH WIRE.
 *
 * RFC 8417 §2.2 defines the claim as a JSON object whose MEMBER NAMES are URIs
 * identifying event statements. That makes the keys IDENTIFIERS rather than field
 * names, and it is the whole interoperability contract: a receiver dispatches on
 * the URI, so a key rewritten by even one character names an event nobody is
 * listening for.
 *
 * ⛔⛔ THAT PROPERTY HAD NEVER BEEN CHECKED. Before this file the JOSE side of
 * `events` had PRESENCE ONLY — a scenario row asserting the key exists, with no
 * assertion about its value — and the only value-level pin anywhere was the COSE
 * one in `classes/cose-claims-encoding.test.ts`. The translator's decode arm
 * carries an explicit comment that the map must NOT join the `address` arm's case
 * flip "because the keys are URIs"; nothing anywhere could see that claim break.
 *
 * ⚠ EVERY WIRE ASSERTION GOES THROUGH THE INDEPENDENT INSPECTOR
 * (`__fixtures__/inspect-token.ts` — raw `cbor2` and base64url, importing nothing
 * from `src/internal/` or `src/classes/`). Reading a token back through aegis's
 * own decoder proves the writer and the reader agree, which a case flip applied
 * symmetrically in both directions satisfies perfectly.
 *
 * ⛔ THE EXPECTED KEYS BELOW ARE WRITTEN OUT, NOT DERIVED. A test that built its
 * expectation by running the same conversion the code runs would agree with any
 * conversion at all.
 */

// Inside the fixture keys' validity window — amphora refuses an expired key.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/**
 * The COSE claim key `events` takes, and the reason an interoperable token must
 * not carry it.
 *
 * RFC 8392 §9.1.1 governs the CWT claim key registry and states the boundary in
 * one sentence: "Integer values less than -65536 are marked as Private Use." The
 * SET claim has no registered CWT key at all, so aegis assigns a private-use one
 * — meaningless to any reader but us — and an interoperable token therefore falls
 * back to the JOSE string `events`.
 */
const EVENTS_COSE_LABEL = -65550;

/**
 * Event-type URIs chosen so a CASE CONVERSION WOULD BE VISIBLE.
 *
 * ⚠ A pin built on `urn:lindorm:event:rtbf` proves nothing: every segment is
 * already lower-case, so `snakeCase` and `camelCase` both return it unchanged and
 * a translator that flipped every key would still pass. Each URI here changes
 * under at least one of the two conversions, and the second is the OIDC
 * Back-Channel Logout event, which a real deployment dispatches on.
 */
const CAMEL_SEGMENT_URI = "https://schemas.lindorm.test/event/accountRecovery";
const HYPHENATED_URI = "http://schemas.openid.net/event/backchannel-logout";
const URN_MIXED_URI = "urn:lindorm:event:sessionRevoked";

/**
 * The map exactly as it must appear on BOTH wires — one table, asserted against
 * each encoding, because "the two wires agree" is the fact worth being able to
 * see break.
 *
 * ⚠ THE PAYLOAD MEMBERS ARE HOSTILE TO A CASE FLIP TOO. RFC 8417 §2.2 leaves an
 * event's payload to whoever defines the event type, so a member spelled
 * `subject_id` or `initiatingParty` belongs to that definition and not to this
 * package's house convention.
 */
const EVENTS: Dict = {
  [CAMEL_SEGMENT_URI]: { initiatingParty: "helpdesk", subject_id: "user-1" },
  [HYPHENATED_URI]: {},
  [URN_MIXED_URI]: { session_id: "sess-1" },
};

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
      sign: { key: { kryptos: TEST_EC_KEY_SIG }, tokenId: "events-wire-1" },
    },
  );

  return signed.token;
};

/**
 * The raw claim value a token carries, in the wire's own vocabulary.
 *
 * THROWS rather than returning `undefined` for a payload it cannot read or a
 * claim that is not there: every assertion below is an equality over this value,
 * and an equality against `undefined` that was meant to run against a map is the
 * vacuous pass the inspector exists to prevent.
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
 * A COSE map rendered to plain objects.
 *
 * ⚠ SAFE HERE, AND NOT SAFE EVERYWHERE. `Object.fromEntries` stringifies a key,
 * so a member that arrived under the integer `2` would compare equal to one under
 * the text `"2"` — RFC 9052 §1.5 keeps those apart (`label = int / tstr`) and the
 * compact actor pins compare `Map` against `Map` for exactly that reason. An
 * `events` map has no integer form at any depth: its keys are URIs and its
 * payload members are the event definition's own strings, so no key here can be
 * an integer for the stringification to blur.
 */
const plain = (value: unknown): unknown =>
  value instanceof Map
    ? Object.fromEntries([...value].map(([key, inner]) => [key, plain(inner)]))
    : value;

/**
 * The `events` claim a read reports, reached through a cast.
 *
 * ⚠ THE CAST IS A FINDING, NOT A CONVENIENCE. `events` is `bucket: "claims"` and
 * the TOKEN read resolves every registered claim, so `claims.events` is populated
 * at runtime — but the claim carries no `domainClaim` mark, so `DomainClaims` does
 * not declare the name and a consumer cannot reach the value without a cast of
 * their own. The mark is correctly ABSENT (it would pull `events` into the verify
 * FLOOR read, where `internal/claims/translate.ts`'s `wireToFloorClaims` needs it
 * to stay in `custom` verbatim for the profiles that require it), so the divergence
 * is between the type and the token read rather than a wrong cell. Recorded rather
 * than papered over.
 */
const eventsOf = (parsed: { claims: Dict }): unknown => parsed.claims.events;

/** A JOSE token nobody signed, carrying a hand-written payload. */
const forgeJose = (payload: string): string => {
  const header = Buffer.from(
    JSON.stringify({ alg: "ES512", typ: "JWT" }),
    "utf8",
  ).toString("base64url");

  return `${header}.${Buffer.from(payload, "utf8").toString("base64url")}.AAAA`;
};

/**
 * A COSE_Sign1 nobody signed, inside the CWT tag — built with raw `cbor2`, so
 * nothing about the token comes from the code under test.
 */
const forgeCose = (claims: Map<number | string, unknown>): string =>
  Buffer.from(
    encode(
      new Tag(
        CBOR_TAG.cwt,
        new Tag(CBOR_TAG.sign1, [
          encode(new Map<number, unknown>([[1, -36]])),
          new Map<number, unknown>(),
          encode(claims),
          Buffer.alloc(4),
        ]),
      ),
    ),
  ).toString("base64url");

/** The claim bag a forged COSE token needs before it carries anything else. */
const coseFloor = (events: unknown): Map<number | string, unknown> =>
  new Map<number | string, unknown>([
    [1, ISSUER],
    [2, "user-1"],
    [4, 9999999999],
    ["events", events],
  ]);

describe("the events claim on the wire", () => {
  test("a JOSE token carries every event-type URI as its own key, unmangled", async () => {
    const token = await mint("jwt", { events: EVENTS });

    // Whole-value equality, not a subset and not a key list: a subset match
    // passes over an event the token dropped, and a key-only match passes over a
    // payload whose members were rewritten. Written out rather than compared to
    // `EVENTS` by reference — the constant is the intent, and asserting the wire
    // against a literal is what makes a silent conversion visible in the diff.
    expect(wireClaimOf(token, "events")).toEqual({
      "https://schemas.lindorm.test/event/accountRecovery": {
        initiatingParty: "helpdesk",
        subject_id: "user-1",
      },
      "http://schemas.openid.net/event/backchannel-logout": {},
      "urn:lindorm:event:sessionRevoked": { session_id: "sess-1" },
    });
  });

  test("a JOSE token keeps the events in the order the caller wrote them", async () => {
    // JSON preserves insertion order, so this IS a statement about the bytes.
    const token = await mint("jwt", { events: EVENTS });

    expect(Object.keys(wireClaimOf(token, "events") as Dict)).toEqual([
      CAMEL_SEGMENT_URI,
      HYPHENATED_URI,
      URN_MIXED_URI,
    ]);
  });

  test("an INTEROPERABLE COSE token carries the map under the STRING claim key", async () => {
    const token = await mint("cwt", { events: EVENTS });
    const inspection = inspectToken(token);

    if (inspection.wire !== "cose" || inspection.payload.readable === false) {
      throw new Error("the mint did not produce a readable COSE payload");
    }

    // The claim KEY and the map's own keys are two questions, and this is the
    // first: a private-use integer is meaningless to any reader but us.
    expect(inspection.payload.value.has("events")).toBe(true);
    expect(inspection.payload.value.has(EVENTS_COSE_LABEL)).toBe(false);
  });

  test("a PROPRIETARY COSE token carries it under the private-use LABEL instead", async () => {
    const token = await mint("cwt", { events: EVENTS }, true);
    const inspection = inspectToken(token);

    if (inspection.wire !== "cose" || inspection.payload.readable === false) {
      throw new Error("the mint did not produce a readable COSE payload");
    }

    expect(inspection.payload.value.has(EVENTS_COSE_LABEL)).toBe(true);
    expect(inspection.payload.value.has("events")).toBe(false);
  });

  test("a COSE token carries the URI keys as TEXT labels, unmangled, in both modes", async () => {
    // ⭐ THE SAME TABLE AS THE JOSE ROW, ON THE OTHER ENCODING. The two wires
    // reach the value through different code — the translator, then the CWT byte
    // shaper's verbatim arm — so "the URI survives" has to be asserted of each.
    // RFC 9052 §1.5 admits a text map key, which is what an event-type URI takes.
    for (const [mode, proprietary] of [
      ["interoperable", undefined],
      ["proprietary", true],
    ] as const) {
      const token = await mint("cwt", { events: EVENTS }, proprietary);
      const key = proprietary === true ? EVENTS_COSE_LABEL : "events";

      expect({ mode, events: plain(wireClaimOf(token, key)) }).toEqual({
        mode,
        events: {
          "https://schemas.lindorm.test/event/accountRecovery": {
            initiatingParty: "helpdesk",
            subject_id: "user-1",
          },
          "http://schemas.openid.net/event/backchannel-logout": {},
          "urn:lindorm:event:sessionRevoked": { session_id: "sess-1" },
        },
      });
    }
  });

  test("a URI key a PRODUCER wrote survives the READ on both wires", async () => {
    // The write side above and the read side here are separate rules: a flip
    // applied in both directions round-trips perfectly and still hands every
    // consumer an event name no dispatcher recognises. The read is driven from
    // FORGED tokens, so the value under test never passed through the writer.
    const forged = [
      forgeJose(
        `{"iss":"${ISSUER}","sub":"u","exp":9999999999,"events":{"${CAMEL_SEGMENT_URI}":{"initiatingParty":"helpdesk"},"${HYPHENATED_URI}":{}}}`,
      ),
      forgeCose(
        coseFloor(
          new Map<string, unknown>([
            [CAMEL_SEGMENT_URI, new Map([["initiatingParty", "helpdesk"]])],
            [HYPHENATED_URI, new Map()],
          ]),
        ),
      ),
    ];

    for (const token of forged) {
      const parsed = aegis.parse(token);

      expect(eventsOf(parsed)).toEqual({
        "https://schemas.lindorm.test/event/accountRecovery": {
          initiatingParty: "helpdesk",
        },
        "http://schemas.openid.net/event/backchannel-logout": {},
      });
    }
  });

  // ---------------------------------------------------------------------------
  // `__proto__` — the refusal `events` never had.
  // ---------------------------------------------------------------------------

  test("a `__proto__` event type is refused at the UNAUTHENTICATED JOSE door", () => {
    // ⛔⛔ WHAT WAS MEASURED BEFORE THIS STEP, at `aegis.parse` on this very
    // token: `Object.keys(claims.events)` was `["urn:e"]` and
    // `JSON.stringify(claims.events)` was `{"urn:e":{}}` while
    // `claims.events.pollutedParse` returned `"yes"`. `__proto__` is a legal JSON
    // member name that `JSON.parse` makes an ordinary own property, and the read
    // side's `omitUndefined` rebuild then re-invoked it as a SETTER — so a
    // consumer's natural read returned attacker data that every audit log renders
    // as absent, and no duplicate-key defence could see it because no own key
    // survived to be claimed twice.
    //
    // ⭐ THE TOKEN IS FORGED AND `parse` IS THE DOOR. `parse` reports a payload
    // WITHOUT checking a signature, so the attacker needs no key at all — and a
    // token MINTED through this package cannot carry the member (measured: the
    // same normalisation eats it before signing), so a signed one would prove
    // nothing about the read side.
    expect(() =>
      aegis.parse(
        forgeJose(
          `{"iss":"${ISSUER}","sub":"u","exp":9999999999,"events":{"__proto__":{"pollutedParse":"yes"},"urn:e":{}}}`,
        ),
      ),
    ).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "events",
          invalid: [
            {
              key: "events.__proto__",
              message:
                'Member "__proto__" is not a member name any structure may use, in "events"',
            },
          ],
        },
      }) as unknown as Error,
    );
  });

  test("a `__proto__` INSIDE an event payload is refused at its own depth", () => {
    // ⚠ THE HALF A PER-KEY CHECK WOULD MISS. An event's payload is a third-party
    // shape carried untouched, so nothing descends into it — and the rebuild that
    // creates the swap descends into everything. Measured before this step:
    // `Object.keys(claims.events["urn:e"])` was `[]` while
    // `claims.events["urn:e"].deep` returned `"yes"`. The key names WHICH event,
    // because at depth `__proto__` alone does not locate it.
    expect(() =>
      aegis.parse(
        forgeJose(
          `{"iss":"${ISSUER}","sub":"u","exp":9999999999,"events":{"urn:e":{"__proto__":{"deep":"yes"}}}}`,
        ),
      ),
    ).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "events",
          invalid: [
            {
              key: "events.urn:e.__proto__",
              message:
                'Member "__proto__" is not a member name any structure may use, in "events.urn:e"',
            },
          ],
        },
      }) as unknown as Error,
    );
  });

  test("a COSE map carrying a text `__proto__` label is refused too", () => {
    // RFC 9052 §1.5 admits a TEXT label (`label = int / tstr`), and `cbor2`
    // decodes such a key to an OWN property rather than to a prototype swap —
    // which is exactly what leaves it reachable. Measured before this step, on
    // this token: keys `["urn:e"]`, stringify `{"urn:e":{}}`, and
    // `claims.events.pollutedParse` returning `"yes"`.
    expect(() =>
      aegis.parse(
        forgeCose(
          coseFloor(
            new Map<string, unknown>([
              ["__proto__", { pollutedParse: "yes" }],
              ["urn:e", new Map()],
            ]),
          ),
        ),
      ),
    ).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "events",
          invalid: [
            {
              key: "events.__proto__",
              message:
                'Member "__proto__" is not a member name any structure may use, in "events"',
            },
          ],
        },
      }) as unknown as Error,
    );
  });

  test("both vocabulary doors refuse it, so the rule is not a property of one path", () => {
    // ⚠ COMPUTED KEYS ONLY. `{ "__proto__": … }` written as an object literal is
    // a prototype setter at parse time and creates no own key, so a literal would
    // hand these doors a clean value and both rows would pass without checking
    // anything.
    expect(() =>
      Aegis.toDomain(JSON.parse('{"events":{"__proto__":{"pwn":"yes"},"urn:e":{}}}')),
    ).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }) as unknown as Error,
    );

    // The WRITE door matters on its own: `Aegis.toWire` hands the caller a dict in
    // which `__proto__` is still a live own data property (measured:
    // `{"urn:e":{"__proto__":{"pwn":"yes"}}}`), and the first thing that rebuilds
    // it re-creates the swap.
    expect(() =>
      Aegis.toWire(JSON.parse('{"events":{"urn:e":{"__proto__":{"pwn":"yes"}}}}')),
    ).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }) as unknown as Error,
    );
  });

  // ---------------------------------------------------------------------------
  // The non-object form.
  // ---------------------------------------------------------------------------

  // ⚠⚠ CORRECTED FROM "a non-object `events` does not resolve, on either wire",
  // which asserted a DROP and argued for it. The argument was that `events` is
  // not a claim this package can validate at read time, and that a profile
  // requiring it reads the raw wire value through
  // `internal/utils/rules/events-shape.ts` — so refusing here "would take that
  // answer away from the layer that can phrase it". That reasoning survives for
  // the KEYS and the PAYLOADS, which aegis still says nothing about, and it never
  // reached the question this row asks: whether the value is a map at all is not
  // a fact about any event definition, and a reader that answers "no events" for
  // a token carrying a value reports a statement the issuer did not make. The
  // shape rule is also not a substitute — it binds only where a profile declares
  // it, and the profile-less `parse` below declares nothing.
  test("a non-object `events` is refused, not reported as a token stating none", () => {
    for (const value of ["not-an-object", 42, ["urn:e"]] as const) {
      expect(() => Aegis.toDomain({ events: value } as Dict)).toThrow(
        expect.objectContaining({
          code: "claim_structure_invalid",
          data: {
            claim: "events",
            invalid: [{ key: "events", message: 'Claim "events" must be an object' }],
          },
        }) as unknown as Error,
      );
    }

    // ⭐ A FOREIGN TOKEN ON EACH WIRE, through the profile-less `parse` — the door
    // with no shape rule behind it, and the one a stranger's token arrives at.
    expect(() =>
      aegis.parse(
        forgeJose(`{"iss":"${ISSUER}","sub":"u","exp":9999999999,"events":"not-a-map"}`),
      ),
    ).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }) as unknown as Error,
    );

    expect(() => aegis.parse(forgeCose(coseFloor("not-a-map")))).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }) as unknown as Error,
    );
  });

  // ⚠ `null` IS ABSENCE, NOT A CONTRADICTION — the sibling of the row above and
  // the only spelling of absence a JSON or CBOR payload can carry. An issuer
  // writing `events: null` states no events, and that is reported rather than
  // refused.
  test("a null `events` is a token stating none, on either wire", () => {
    expect(eventsOf(Aegis.toDomain({ events: null } as Dict))).toBeUndefined();

    expect(
      eventsOf(
        aegis.parse(
          forgeJose(`{"iss":"${ISSUER}","sub":"u","exp":9999999999,"events":null}`),
        ),
      ),
    ).toBeUndefined();

    expect(eventsOf(aegis.parse(forgeCose(coseFloor(null))))).toBeUndefined();
  });

  test("a caller-supplied `Map` is scanned too, at the claim and at depth", () => {
    // ⭐ THE DOOR THE `Map` ARM IS ACTUALLY REACHED BY — the WRITE side, not the
    // COSE read. A decoded COSE claim is a plain object by the time the claim
    // boundary sees it (`internal/cose/cwt-spec.ts`'s `decompactValue` runs
    // `compactDecode` on any `Map`, with no `proprietary` test), so nothing on the
    // read path presents one. A CALLER can: RFC 9052 §1.5 admits non-string map
    // keys (`label = int / tstr`), which makes a `Map` the natural way to hand this
    // package such a claim, and nothing converts it before the scan.
    //
    // ⚠ Without this row the arm would be exercised only by its own unit test —
    // which is exactly how the arm's first justification came to cite a
    // measurement that was three hits from that unit test and nothing else.
    // ⚠⚠ TWO ENTRIES, AND THE SECOND IS A CORRECTION RATHER THAN NOISE. A `Map`
    // is not `isObject` (measured: `isObject(new Map())` is `false`), so a `Map`
    // handed to `events` never reached a wire at all — the encode arm returned
    // `undefined` and the claim vanished from the token in silence. It is refused
    // now, by the same guard that refuses any other non-object, so a caller who
    // reaches for the shape RFC 9052 §1.5 makes natural is TOLD rather than issued
    // a token missing the claim they asked for. The `__proto__` refusal is
    // unchanged and still comes first: it is a CLAIM-level scan that runs before
    // any codec (`internal/claims/proto-member-violations.ts`), which is exactly
    // why it reaches inside a value the codec then rejects.
    expect(() =>
      Aegis.toWire({ events: new Map([["__proto__", { pwn: "yes" }]]) } as Dict),
    ).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "events",
          invalid: [
            {
              key: "events.__proto__",
              message:
                'Member "__proto__" is not a member name any structure may use, in "events"',
            },
            { key: "events", message: 'Claim "events" must be an object' },
          ],
        },
      }) as unknown as Error,
    );

    expect(() =>
      Aegis.toWire({
        events: { "urn:e": new Map([["__proto__", { pwn: "yes" }]]) },
      } as Dict),
    ).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "events",
          invalid: [
            {
              key: "events.urn:e.__proto__",
              message:
                'Member "__proto__" is not a member name any structure may use, in "events.urn:e"',
            },
          ],
        },
      }) as unknown as Error,
    );
  });

  // ⚠ CORRECTED FROM "aegis will not WRITE a non-object `events` either", which
  // asserted the write side merely DROPPED it. Both sides ask ONE guard now
  // (`eventsMap`, `internal/claims/translate.ts`), so the correction is the same
  // one on both — and the write side is where a caller can still repair the fault.
  test("aegis REFUSES to write a non-object `events`, rather than dropping it", () => {
    expect(() => Aegis.toWire({ events: "not-an-object" } as Dict)).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "events",
          invalid: [{ key: "events", message: 'Claim "events" must be an object' }],
        },
      }) as unknown as Error,
    );

    // ⚠ AND `null` IS STILL OMITTED, on the same door — the boundary the shared
    // guard is not allowed to blur.
    expect(Aegis.toWire({ events: null } as Dict).events).toBeUndefined();
  });
});
