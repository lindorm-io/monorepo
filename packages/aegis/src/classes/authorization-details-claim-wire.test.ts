import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeAll, describe, expect, test } from "vitest";
import { inspectToken } from "../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

/**
 * WHAT AN `authorization_details` CLAIM ACTUALLY SAYS ON EACH WIRE.
 *
 * The claim is an array of objects, each carrying a REQUIRED `type` that decides
 * the object's allowable contents — RFC 9396 §2. Two wire consequences follow:
 *
 *   1. The element's remaining fields belong to whoever registered that `type`.
 *      RFC 9396's own Figure 2 names them `instructedAmount`, `creditorName`
 *      and `creditorAccount` — camelCase — so a token that snake_cased them
 *      would round-trip through this package perfectly and mean nothing to the
 *      resource server the grant is FOR.
 *   2. `type` is what a resource server dispatches on, so its spelling is the
 *      interoperability contract in the same way the OIDC address member names
 *      are.
 *
 * ⚠ EVERY ASSERTION HERE GOES THROUGH THE INDEPENDENT INSPECTOR
 * (`__fixtures__/inspect-token.ts` — raw `cbor2` and base64url, importing
 * nothing from `src/internal/` or `src/classes/`). Reading the token back
 * through aegis's own decoder proves only that the writer and the reader agree,
 * which a pair of mirrored bugs satisfies exactly.
 *
 * ⛔ THE EXPECTED SPELLINGS BELOW ARE WRITTEN OUT, NOT READ FROM THE REGISTRY.
 * A test that derived them from `authorization-details-members.ts` would agree
 * with whatever the registry currently says — including a wrong spelling — so it
 * could state that the wire matches the registry but never that the wire matches
 * RFC 9396.
 */

// Inside the fixture keys' validity window — amphora refuses an expired key.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/**
 * One element in RFC 9396's own shape: the mandatory `type`, two of RFC 9396 §2.2's
 * common data fields, and two type-specific fields spelled the way Figure 2
 * spells them.
 */
const DETAIL: Dict = {
  type: "payment_initiation",
  actions: ["initiate", "status"],
  locations: ["https://api.bank.example.com/payments"],
  instructedAmount: { currency: "EUR", amount: "123.50" },
  creditorAccount: { iban: "DE02100100109307118603" },
};

/**
 * The lindorm private-use COSE label the CLAIM carries, written out rather than
 * read from the registry for the same reason as the field names.
 *
 * ⚠ THE CLAIM KEY AND THE ELEMENT FIELD KEYS ARE DIFFERENT QUESTIONS. The claim
 * has an integer label, emitted only in proprietary mode (a CWT claim key below
 * -65536 is Private Use — RFC 8392 §9.1.1) and degrading to the string
 * `authorization_details` otherwise. Its elements' fields have no COSE registry
 * at all and are text-keyed in both modes.
 */
const AUTHORIZATION_DETAILS_COSE_LABEL = -65542;

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
  authorizationDetails: unknown,
  proprietary?: true,
): Promise<string> => {
  const signed = await aegis.mint(
    "default",
    {
      subject: "user-1",
      expires: "1h",
      authorizationDetails,
    } as never,
    {
      format,
      proprietary,
      sign: { key: { kryptos: TEST_EC_KEY_SIG }, tokenId: "rar-wire-1" },
    },
  );

  return signed.token;
};

/**
 * The raw `authorization_details` value a token carries, in the wire's own
 * vocabulary.
 *
 * THROWS rather than returning `undefined` for a payload it cannot read or a
 * claim that is not there: every assertion below is an equality over this value,
 * and an equality against `undefined` that was meant to run against an array is
 * the vacuous pass the inspector exists to prevent.
 */
const wireDetailsOf = (token: string, key: number | string): Array<Dict> => {
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

  if (!Array.isArray(value)) {
    throw new Error(`the claim is not an array — it is a ${typeof value}`);
  }

  // CBOR decodes a map to a `Map` (the inspector keeps `preferMap` on, because a
  // COSE label is `int / tstr` — RFC 9052 §1.5 — and CBOR keys the two apart);
  // JSON to a plain object. Rendered to one shape HERE, in the test, and RECURSIVELY — a
  // type-specific field's value is itself an object, and a shallow render would
  // compare a `Map` against an object literal and fail for the wrong reason.
  const render = (node: unknown): unknown => {
    if (node instanceof Map) {
      return Object.fromEntries([...node].map(([k, v]) => [k, render(v)]));
    }
    if (Array.isArray(node)) return node.map(render);

    return node;
  };

  return value.map(render) as Array<Dict>;
};

describe("the authorization_details claim on the wire", () => {
  test("a JOSE token carries the element exactly as RFC 9396 spells it", async () => {
    const token = await mint("jwt", [DETAIL]);

    // Whole-value equality, not a subset: a subset match passes over a field the
    // token dropped, and a dropped field silently narrows a grant.
    expect(wireDetailsOf(token, "authorization_details")).toEqual([
      {
        type: "payment_initiation",
        actions: ["initiate", "status"],
        locations: ["https://api.bank.example.com/payments"],
        // ⭐ THE CAMELCASE ANCHOR. These are the type registrant's field names,
        // not lindorm's, and the mechanical snake_case flip an undeclared
        // `address` member takes would rewrite them into `instructed_amount` and
        // `creditor_account` — fields the payment API is not looking for.
        instructedAmount: { currency: "EUR", amount: "123.50" },
        creditorAccount: { iban: "DE02100100109307118603" },
      },
    ]);
  });

  test("a COSE token carries the element exactly as the JOSE token does", async () => {
    const token = await mint("cwt", [DETAIL]);

    // Stated as its own assertion rather than inferred from the JOSE row: the
    // two wires reach this value through different code — the translator shapes
    // it, then the CWT byte layer re-shapes it — so a change that moved only one
    // of the two shows on exactly one of these rows.
    expect(wireDetailsOf(token, "authorization_details")).toEqual([
      {
        type: "payment_initiation",
        actions: ["initiate", "status"],
        locations: ["https://api.bank.example.com/payments"],
        instructedAmount: { currency: "EUR", amount: "123.50" },
        creditorAccount: { iban: "DE02100100109307118603" },
      },
    ]);
  });

  test("the COSE claim key is the interoperable string, not the private-use label", async () => {
    const token = await mint("cwt", [DETAIL]);
    const inspection = inspectToken(token);

    if (inspection.wire !== "cose" || inspection.payload.readable === false) {
      throw new Error("the mint did not produce a readable COSE payload");
    }

    // A claim key below -65536 is Private Use (RFC 8392 §9.1.1), so a token
    // carrying one is meaningless to any reader but us. The interoperable
    // default must therefore key the claim by its string name.
    expect(inspection.payload.value.has("authorization_details")).toBe(true);
    expect(inspection.payload.value.has(AUTHORIZATION_DETAILS_COSE_LABEL)).toBe(false);
  });

  test("the proprietary COSE encoding moves the CLAIM to its label and leaves the ELEMENTS alone", async () => {
    const token = await mint("cwt", [DETAIL], true);

    // The split the claim/field distinction rests on: the compact mode changes
    // how the CLAIM is keyed and nothing about how its elements are. A mode that
    // reached inside would be inventing labels no registry assigns.
    expect(wireDetailsOf(token, AUTHORIZATION_DETAILS_COSE_LABEL)).toEqual([
      {
        type: "payment_initiation",
        actions: ["initiate", "status"],
        locations: ["https://api.bank.example.com/payments"],
        instructedAmount: { currency: "EUR", amount: "123.50" },
        creditorAccount: { iban: "DE02100100109307118603" },
      },
    ]);
  });

  test("a JOSE token keeps the elements, and each element's fields, in the caller's order", async () => {
    // JSON preserves insertion order, so this IS a statement about the bytes: a
    // walker that emitted its member DECLARATION first and the undeclared tail
    // afterwards would move `type` to the front of every element and change the
    // bytes of a signed token while every round trip still agreed with itself.
    // `Object.keys`, not `toEqual`, because equality over objects is
    // order-insensitive and would hold either way.
    const token = await mint("jwt", [
      { creditorName: "Merchant A", type: "payment_initiation", actions: ["initiate"] },
      { type: "account_information", locations: ["https://api.bank.example.com"] },
    ]);

    const details = wireDetailsOf(token, "authorization_details");

    expect(details.map((element) => Object.keys(element))).toEqual([
      ["creditorName", "type", "actions"],
      ["type", "locations"],
    ]);
  });

  test("an empty element list still reaches the wire, on both wires", async () => {
    // The claim declares `whenEmpty: "keep"`, and that verdict is the whole
    // reason the column exists: an empty RAR structure grants nothing while an
    // absent one restricts nothing, so pruning it would BROADEN what the token
    // permits. Asserted on the RAW wire because that is the only place the
    // difference is visible — a pruned claim and a claim the caller never wrote
    // are indistinguishable once the token is read back.
    for (const format of ["jwt", "cwt"] as const) {
      const token = await mint(format, []);

      expect({ format, details: wireDetailsOf(token, "authorization_details") }).toEqual({
        format,
        details: [],
      });
    }
  });

  test("a required member written with the WRONG SHAPE says so, not that it is empty", async () => {
    // ⚠ THE REPAIR INSTRUCTION IS THE ASSERTION. `isClaimSatisfied` is false for
    // an ABSENT member, a PRUNED empty one and a value that failed its own codec,
    // and only the third is a shape problem — a caller who wrote `type: 42` must
    // not be told the member "must not be empty" and sent looking for a field they
    // already wrote. The sibling feature scenarios pin the empty-`type` refusal, so
    // the two messages are pinned apart rather than one replacing the other.
    await expect(
      aegis.mint(
        "default",
        {
          subject: "user-1",
          expires: "1h",
          authorizationDetails: [{ type: 42 }],
        } as never,
        { sign: { key: { kryptos: TEST_EC_KEY_SIG }, tokenId: "rar-shape-1" } },
      ),
    ).rejects.toMatchObject({
      code: "claim_structure_invalid",
      data: {
        claim: "authorizationDetails",
        invalid: [
          {
            key: "authorizationDetails[0].type",
            message: 'Member "type" is required and must be the shape it declares',
          },
        ],
      },
    });
  });

  test("a null mandatory member is reported as unstated, not as the wrong shape", async () => {
    // ⭐⭐ THE ONE PLACE A REQUIRED MEMBER CAN SHOW WHICH SIDE OF THE BOUNDARY A
    // VALUE FELL ON, and therefore the pin that keeps the two rulings apart. Both
    // refusals name the same member at the same position; only the WORDING says
    // whether the walker judged `null` a value that contradicts the declaration
    // or a statement never made. It said "must be the shape it declares" before
    // `null` became an absence — which sent a caller looking for a type error in
    // a field whose real fault is that it is empty.
    //
    // ⚠ The sibling above pins `type: 42` on the OTHER wording, so the two are
    // pinned apart rather than one message quietly absorbing both.
    await expect(
      aegis.mint(
        "default",
        {
          subject: "user-1",
          expires: "1h",
          authorizationDetails: [{ type: null }],
        } as never,
        { sign: { key: { kryptos: TEST_EC_KEY_SIG }, tokenId: "rar-shape-2" } },
      ),
    ).rejects.toMatchObject({
      code: "claim_structure_invalid",
      data: {
        claim: "authorizationDetails",
        invalid: [
          {
            key: "authorizationDetails[0].type",
            message: 'Member "type" is required and must not be empty',
          },
        ],
      },
    });
  });
});
