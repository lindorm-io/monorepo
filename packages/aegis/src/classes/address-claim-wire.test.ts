import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeAll, describe, expect, test } from "vitest";
import { inspectToken } from "../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

/**
 * WHAT AN `address` CLAIM ACTUALLY SAYS ON EACH WIRE.
 *
 * The address claim's member spellings — `formatted`, `street_address`,
 * `locality`, `region`, `postal_code`, `country` (OIDC Core §5.1.1) — ARE the
 * interoperability contract: a relying party reads `street_address` and nothing
 * else. A token that carried
 * `streetAddress`, or that dropped a member, would round-trip through this
 * package perfectly and mean nothing to anyone else.
 *
 * ⚠ EVERY ASSERTION HERE GOES THROUGH THE INDEPENDENT INSPECTOR
 * (`__fixtures__/inspect-token.ts` — raw `cbor2` and base64url, importing
 * nothing from `src/internal/` or `src/classes/`). Reading the token back
 * through aegis's own decoder proves only that the writer and the reader agree,
 * which a pair of mirrored bugs satisfies exactly.
 *
 * ⛔ THE EXPECTED SPELLINGS BELOW ARE WRITTEN OUT, NOT READ FROM THE REGISTRY.
 * A test that derives them from `address-members.ts` agrees with whatever the
 * registry currently says — including a wrong spelling — so it could state that
 * the wire matches the registry but never that the wire matches OIDC Core.
 */

// Inside the fixture keys' validity window — amphora refuses an expired key.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/**
 * The seven members a lindorm address carries, in the DOMAIN vocabulary, each
 * with a value distinct enough that a member swapped for another shows up as a
 * wrong value rather than as an equal one.
 */
const ADDRESS = {
  formatted: "Sample 1\n00100 Stockholm\nSweden",
  streetAddress: "Sample 1",
  locality: "Stockholm",
  region: "Stockholms lan",
  postalCode: "00100",
  country: "SE",
  careOf: "Sample Recipient",
};

/** The same seven, in the WIRE vocabulary. Written out — see the file docstring. */
const WIRE_ADDRESS: Dict = {
  formatted: "Sample 1\n00100 Stockholm\nSweden",
  street_address: "Sample 1",
  locality: "Stockholm",
  region: "Stockholms lan",
  postal_code: "00100",
  country: "SE",
  care_of: "Sample Recipient",
};

/**
 * The lindorm private-use COSE label the `address` CLAIM carries, written out
 * rather than read from the registry for the same reason as the member names.
 *
 * ⚠ THE CLAIM KEY AND THE MEMBER KEYS ARE DIFFERENT QUESTIONS. The claim has an
 * integer label, emitted only in proprietary mode — a CWT CLAIM KEY below -65536
 * is Private Use (RFC 8392 §9.1.1), so an interoperable token must not carry one
 * and degrades to the string `address`. Its MEMBERS have no COSE registry at all
 * and are text-keyed in both modes.
 */
const ADDRESS_COSE_LABEL = -65557;

const logger = createMockLogger();

let aegis: Aegis;

beforeAll(async () => {
  const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

  await amphora.setup();
  amphora.add(TEST_EC_KEY_SIG);

  aegis = new Aegis({ amphora, logger });
});

type Address = { profile?: { address?: Dict } };

const mint = async (
  format: "jwt" | "cwt",
  address: Dict,
  proprietary?: true,
): Promise<string> => {
  const signed = await aegis.mint(
    "default",
    {
      subject: "user-1",
      expires: "1h",
      profile: { address },
    } as never,
    {
      format,
      proprietary,
      sign: { key: { kryptos: TEST_EC_KEY_SIG }, tokenId: "address-wire-1" },
    },
  );

  return signed.token;
};

/**
 * The raw `address` claim value a token carries, in the wire's own vocabulary.
 *
 * THROWS rather than returning `undefined` for a payload it cannot read or a
 * claim that is not there: every assertion below is an equality over this value,
 * and an equality against `undefined` that was meant to run against an object is
 * the vacuous pass the inspector exists to prevent.
 */
const wireAddressOf = (token: string, key: number | string): Dict => {
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

  // A COSE map decodes to a `Map` (the inspector keeps `preferMap` on, because a
  // COSE label is `int / tstr` — RFC 9052 §1.5 — and CBOR keys the two apart);
  // a JOSE one to a plain object. Rendered to one shape HERE, in the test, so the two
  // wires can be compared against the same written-out expectation — and so a
  // member that arrived under an INTEGER key would surface as the number it is
  // rather than being silently stringified into agreement.
  return value instanceof Map ? (Object.fromEntries(value) as Dict) : (value as Dict);
};

describe("the address claim on the wire", () => {
  test("a JOSE token spells every member the way OIDC Core §5.1.1 does", async () => {
    const token = await mint("jwt", ADDRESS);

    // Whole-value equality, not a subset: a subset match passes over a member
    // the token dropped, and dropping a member is the failure mode a declared
    // member set exists to prevent.
    expect(wireAddressOf(token, "address")).toEqual(WIRE_ADDRESS);
  });

  test("a COSE token spells every member exactly as the JOSE token does", async () => {
    const token = await mint("cwt", ADDRESS);

    // RFC 8392 assigns integer labels to CLAIMS, and no COSE registry names the
    // OIDC address members — so a COSE address map is TEXT-keyed inside, with
    // the same spellings JOSE uses. Stated as its own assertion rather than
    // inferred from the JOSE row: the two wires reach this value through
    // different code, and the whole point of the member set is that they agree.
    expect(wireAddressOf(token, "address")).toEqual(WIRE_ADDRESS);
  });

  test("a JOSE token keeps the members in the order the caller wrote them", async () => {
    // JSON preserves insertion order, so this IS a statement about the bytes: a
    // translator that walked its member DECLARATION instead of the caller's
    // value would re-order every address and move bytes on a signed wire while
    // every round trip still agreed with itself.
    const token = await mint("jwt", {
      region: "Stockholms lan",
      careOf: "Sample Recipient",
      streetAddress: "Sample 1",
    });

    expect(Object.keys(wireAddressOf(token, "address"))).toEqual([
      "region",
      "care_of",
      "street_address",
    ]);
  });

  test("a JOSE token keeps that order when declared and undeclared members INTERLEAVE", async () => {
    // The order rule is what forces the case flip to be applied one key at a
    // time rather than to the undeclared members as a batch. A walk that
    // emitted the declared members first and the undeclared tail afterwards
    // passes the row above — every key there is declared — and re-orders this
    // one. `Object.keys`, not `toEqual`, because equality over objects is
    // order-insensitive and would hold either way.
    const token = await mint("jwt", {
      streetAddress: "Sample 1",
      buildingName: "Sample House",
      region: "Stockholms lan",
    });

    expect(Object.keys(wireAddressOf(token, "address"))).toEqual([
      "street_address",
      "building_name",
      "region",
    ]);
  });

  test("a member value that is not of its declared kind never reaches the wire", async () => {
    // ⚠ THE SYMMETRY THE WIRE IS THE ONLY WITNESS TO. A member declares a value
    // shape and the READ side enforces it, so a writer that emitted a value
    // failing that shape would sign a token asserting `region` while this
    // package's own reader reported that member as never stated. Whole-value
    // equality, and on the RAW wire, because a round trip cannot see the
    // difference between a member that was never written and one the reader
    // discarded.
    //
    // ⚠⚠ `null` DOES NOT STATE THIS RULE — it is an ABSENCE, not a value of the
    // wrong kind, and it has its own two tests below. That is why this one needs
    // a cast past `AegisProfileAddress` altogether: the declared type admits no
    // value that fails the member's own codec, so the fault can only arrive from
    // a door with no type behind it.
    for (const format of ["jwt", "cwt"] as const) {
      const token = await mint(format, {
        streetAddress: "Sample 1",
        region: 42 as unknown as string,
      });

      expect({ format, address: wireAddressOf(token, "address") }).toEqual({
        format,
        address: { street_address: "Sample 1" },
      });
    }
  });

  test("a null member is omitted from the wire, on both wires", async () => {
    // ⭐ THE OWNER'S CASE, on the raw wire: `AegisProfileAddress` declares every
    // member `string | null` so that a caller minting from a database row does
    // not have to strip its nulls first. `null` therefore means the member was
    // not stated, and an unstated member is simply not on the wire.
    //
    // ⚠ It is NOT the same statement as the test above, though the two produce
    // the same bytes here: that one says a value CONTRADICTING the declaration is
    // not written, this one says a null is not a contradiction at all. Where the
    // two come apart is the mint's verdict — see the tail test below, and the
    // structure-member row in the scenario table, both of which a build that
    // treated `null` as a codec failure would fail.
    for (const format of ["jwt", "cwt"] as const) {
      const token = await mint(format, {
        streetAddress: "Sample 1",
        region: null,
        careOf: null,
        country: null,
      });

      expect({ format, address: wireAddressOf(token, "address") }).toEqual({
        format,
        address: { street_address: "Sample 1" },
      });
    }
  });

  test("a null UNDECLARED member is omitted too, rather than riding as a null", async () => {
    // ⭐⭐ THE HALF OF THE NULL RULE THAT IS OBSERVABLE ON `address`, and the one
    // a build can get wrong without any other test noticing. An undeclared member
    // rides through the OPEN tail with no codec to fail, so treating `null` as a
    // value would put a literal `"extra_thing": null` on a SIGNED wire — a member
    // asserting nothing, in a claim whose members are all strings
    // (OIDC Core §5.1.1). A database row's extension column is null exactly as
    // often as its declared ones are.
    for (const format of ["jwt", "cwt"] as const) {
      const token = await mint(format, {
        streetAddress: "Sample 1",
        extraThing: null,
        deliveryNote: null,
      });

      expect({ format, address: wireAddressOf(token, "address") }).toEqual({
        format,
        address: { street_address: "Sample 1" },
      });
    }
  });

  test("a null member is not reported when a foreign token carries one", async () => {
    // The READ direction of the same rule, and the direction a real token
    // exercises: JSON and CBOR can both express `null` and neither can express
    // `undefined`, so this is the only spelling of absence a stranger's payload
    // has. `toEqual`, not a subset match — the whole point is that the member is
    // ABSENT from the reported address rather than present holding `null`.
    expect(
      Aegis.toDomain({
        address: { street_address: "Sample 1", region: null, extra_thing: null },
      } as Dict).profile?.address,
    ).toEqual({ streetAddress: "Sample 1" });
  });

  test("an address that is not an address is refused rather than dropped", async () => {
    // The claim is a structure of sub-fields (OIDC Core §5.1.1). A scalar
    // under that name is a statement this package cannot describe, and reporting
    // the token as carrying no address would be reporting a statement its issuer
    // signed as never made.
    expect(() =>
      Aegis.toDomain({ address: "Sample 1, 00100 Stockholm" } as Dict),
    ).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "address",
          invalid: [{ key: "address", message: 'Claim "address" must be an object' }],
        },
      }) as unknown as Error,
    );

    // ⚠ AND THE BOUNDARY, in the same test, because the two are one rule: the
    // same claim carrying `null` is not refused, it is not stated. BOTH
    // DIRECTIONS — the write side is where a caller minting from a database row
    // whose whole address column is null arrives, and refusing it there is the
    // exact cost the null ruling exists to remove. `Object.hasOwn` on the write:
    // an absent key is the claim, a present key holding `undefined` is not.
    expect(Aegis.toDomain({ address: null } as Dict).profile).toBeUndefined();
    expect(Object.hasOwn(Aegis.toWire({ address: null } as Dict), "address")).toBe(false);
  });

  test("a member the registry does not declare still rides, under a snake key", async () => {
    // The member set is declared but OPEN, so a declaration is not an allowlist.
    // An undeclared member keeps the mechanical key flip every unregistered
    // claim gets — at EVERY depth, which is what the blanket case conversion
    // this replaced did and what a top-level-only flip would quietly stop doing.
    const token = await mint("jwt", {
      streetAddress: "Sample 1",
      buildingName: "Sample House",
      deliveryNote: { doorCode: "1234" },
    });

    expect(wireAddressOf(token, "address")).toEqual({
      street_address: "Sample 1",
      building_name: "Sample House",
      delivery_note: { door_code: "1234" },
    });
  });

  test("the COSE claim key is the interoperable string, not the private-use label", async () => {
    const token = await mint("cwt", ADDRESS);
    const inspection = inspectToken(token);

    if (inspection.wire !== "cose" || inspection.payload.readable === false) {
      throw new Error("the mint did not produce a readable COSE payload");
    }

    // A claim key below -65536 is Private Use (RFC 8392 §9.1.1), so a token
    // carrying one is meaningless to any reader but us. The interoperable
    // default must therefore key the claim by its string name.
    expect(inspection.payload.value.has("address")).toBe(true);
    expect(inspection.payload.value.has(ADDRESS_COSE_LABEL)).toBe(false);
  });

  test("the proprietary COSE encoding moves the CLAIM to its label and leaves the MEMBERS alone", async () => {
    const token = await mint("cwt", ADDRESS, true);

    // The split the claim/member distinction rests on: the compact mode changes
    // how the CLAIM is keyed and nothing about how its members are. A mode that
    // reached inside would be inventing labels no registry assigns.
    expect(wireAddressOf(token, ADDRESS_COSE_LABEL)).toEqual(WIRE_ADDRESS);
  });

  test("an empty member is carried rather than pruned, on both wires", async () => {
    // The members declare `whenEmpty: "keep"`, which is the verdict that carries
    // an empty value onto the wire. Asserted on the RAW wire because that is the
    // only place the difference is visible: a pruned member and a member the
    // caller never wrote are indistinguishable once the token is read back.
    for (const format of ["jwt", "cwt"] as const) {
      const token = await mint(format, { streetAddress: "Sample 1", postalCode: "" });

      expect({ format, address: wireAddressOf(token, "address") }).toEqual({
        format,
        address: { street_address: "Sample 1", postal_code: "" },
      });
    }
  });

  test("two UNDECLARED members that flip onto one key are refused, not merged", async () => {
    // ⛔⛔ THE ONLY FAULT `claimedByTail` EXISTS FOR, and it had ZERO coverage:
    // replacing that lookup with the declared-key map alone left the whole suite
    // green while `{ foo_bar: 1, fooBar: 2 }` silently collapsed to `{ fooBar: 2 }`.
    //
    // ⭐ IT IS SPECIFIC TO `open: "flip"`, which is why it is pinned on `address`
    // and nowhere else. Two DISTINCT undeclared keys can flip onto one key —
    // `foo_bar` and `fooBar` both camelise to `fooBar` — and no declaration can
    // predict that, so the unconditional reservation built from `children()`
    // cannot cover it. A `"verbatim"` tail genuinely cannot collide: its outgoing
    // key IS its incoming key, and an object carries each key once.
    //
    // ⚠ NEITHER KEY IS A DECLARED MEMBER, so this cannot be satisfied by the
    // declared-key reservation — that is the whole point of choosing `foo_bar`.
    await expect(
      aegis.mint(
        "default",
        {
          subject: "user-1",
          expires: "1h",
          profile: { address: { foo_bar: "one", fooBar: "two" } },
        } as never,
        { sign: { key: { kryptos: TEST_EC_KEY_SIG }, tokenId: "addr-tail-1" } },
      ),
    ).rejects.toMatchObject({
      code: "claim_structure_invalid",
      data: {
        claim: "address",
        invalid: [
          {
            key: "address.foo_bar",
            message:
              'Members "fooBar" and "foo_bar" both resolve to "foo_bar" in "address"',
          },
        ],
      },
    });
  });
});
