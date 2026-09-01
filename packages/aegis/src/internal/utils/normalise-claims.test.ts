import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { normaliseClaims } from "./normalise-claims.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

describe("normaliseClaims", () => {
  // Strip 1: absence. `null` and `undefined` at a claim KEY are the absent
  // property of a bag assembled from optional fields, a nullable column
  // included; `undefined` is stripped at every depth besides, because neither
  // wire may carry it. A NESTED null is a member, and members are the walker's
  // (`internal/claims/translate.ts`) — at a raw door, which has no walker, it
  // rides as written. Every other value was written by someone, and only the
  // registry says which of those writings carry nothing.
  describe("the absence strip", () => {
    test("should strip null and undefined at the claim key, undefined at every depth, and keep everything else", () => {
      expect(
        normaliseClaims({
          a: 1,
          b: null,
          c: "",
          d: undefined,
          e: [],
          f: {},
          g: { h: null, i: undefined, j: "" },
        }),
      ).toMatchSnapshot();
    });

    test("should keep zero and false", () => {
      expect(normaliseClaims({ a: 0, b: false })).toMatchSnapshot();
    });

    test("should leave a nested structure alone", () => {
      expect(
        normaliseClaims({ a: { b: { c: "" } }, d: ["", ""], keep: 1 }),
      ).toMatchSnapshot();
    });
  });

  describe("the registry-driven empty prune", () => {
    // The registry's `whenEmpty: "prune"` cells: an empty `nonce`/`amr` is
    // indistinguishable from an unstated one, and the lindorm authority lists
    // (`roles` here) are emitted as absence by the only issuer that mints them.
    test("should prune a registered claim the registry marks prunable", () => {
      expect(
        normaliseClaims({ nonce: "", amr: [], roles: [], sub: "user_1" }),
      ).toMatchSnapshot();
    });

    // The `whenEmpty: "keep"` cells: a restriction (`aud`, `authorization_details`)
    // is a statement.
    //
    // ⚠ `scope` is here and `roles` is not, though both are lists of granted
    // authority. AEGIS POLICY, not a citation: RFC 9068 §2.2.3 makes `scope` only
    // a SHOULD, so absence is indistinguishable from a grant that never had one,
    // which is what leaves an explicit empty list something to say. The lindorm
    // lists have a sole issuer that already emits empty as absence.
    test("should keep a registered claim the registry marks keepable", () => {
      expect(
        normaliseClaims({
          aud: [],
          scope: [],
          authorization_details: [],
          sub: "user_1",
        }),
      ).toMatchSnapshot();
    });

    /**
     * Rule 2 of the prune: aegis does not reshape what it has not declared. A
     * raw kit-sign wire dict and an opaque payload are made of exactly these
     * keys, so a prune that walked them would shred a caller's own structure.
     * It is what keeps the prune safe to run unasked.
     */
    test("should never prune an unregistered key", () => {
      expect(
        normaliseClaims({ empty_list: [], empty_text: "", empty_map: {}, kept: 1 }),
      ).toMatchSnapshot();
    });

    // The COSE claims dict is keyed by the COSE wire name, which RFC 8392
    // renames for the token id — so the cell has to resolve under both.
    test("should resolve the COSE spelling of a claim as well as the JOSE one", () => {
      expect(normaliseClaims({ cti: "", jti: "", sub: "user_1" })).toMatchSnapshot();
    });

    /**
     * TOP LEVEL only. The registry reads an empty `actions` (RFC 9396 §2.2) as
     * granting no action, where an ABSENT one is not restricted by action at all
     * — the second half is aegis's inference. The inner members of a claim are its
     * own declared structure and the registry describes none of them, so recursion
     * would invert a restriction one level down.
     */
    test("should not recurse into a claim's own structure", () => {
      expect(
        normaliseClaims({
          authorization_details: [{ type: "pay", actions: [], locations: [] }],
        }),
      ).toMatchSnapshot();
    });

    test("should keep zero and false", () => {
      expect(normaliseClaims({ loa: 0, email_verified: false })).toMatchSnapshot();
    });
  });
});

describe("normaliseClaims — emission regressions", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: "https://test.lindorm.io/" }, logger });
    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TEST_EC_KEY_SIG);
  });

  /**
   * An OPAQUE payload handed to `sign` is the caller's data, not a claim set the
   * issuer authored. A recursive empty-prune walked it and deleted every branch
   * whose leaves were empty strings, so a caller's nested structure arrived at the
   * verifier with whole subtrees missing — a silent, unrecoverable loss of shape.
   * `""` is not `undefined` and none of these keys is registered, so the
   * normalisation reaches none of it even though it now always runs.
   */
  /**
   * `undefined` is stripped at EVERY depth, not only at the claim key: cbor2
   * writes a nested `undefined` as CBOR simple value 23 (RFC 8949 §3.3), so a raw
   * CWT door handed a custom claim assembled from optionals would otherwise put a
   * present member holding nothing on a signed wire, where JSON writes no member
   * at all. `Object.hasOwn`, because a decoded simple 23 is a PRESENT key holding
   * `undefined`, which `toEqual` cannot tell from an absent one.
   */
  test("should strip a nested undefined from a custom claim at the raw CWT door", async () => {
    const { token } = await aegis.cwt.sign({ x: { y: undefined, z: 1 } } as Dict);

    const parsed = await aegis.cwt.verify(token);

    expect(parsed.payload.x).toEqual({ z: 1 });
    expect(Object.hasOwn(parsed.payload.x as Dict, "y")).toBe(false);
  });

  test("should not shred a nested opaque payload", async () => {
    const { token } = await aegis.jws.sign({ a: { b: { c: "" } }, keep: 1 });

    const [, rawPayload] = token.split(".");

    expect(JSON.parse(B64.toString(rawPayload))).toEqual({
      a: { b: { c: "" } },
      keep: 1,
    });
  });

  /**
   * An EMPTY `actions` array grants no action at all (RFC 9396 §2.2); that an
   * ABSENT one is instead not restricted by action is the registry's own reading.
   * ⚠ Dropping the empty array INVERTS the restriction — the most permissive
   * reading of a maximally restrictive statement. The registry's
   * `authorization_details` cell is what has to hold here, on every call.
   */
  test("should keep an empty actions array in authorization_details", async () => {
    const { token } = await aegis.jws.sign({
      iss: "https://test.lindorm.io/",
      sub: "user_1",
      authorization_details: [{ type: "pay", actions: [], locations: ["x"] }],
    });

    const [, rawPayload] = token.split(".");
    const decoded = JSON.parse(B64.toString(rawPayload));

    expect(decoded.authorization_details).toEqual([
      { type: "pay", actions: [], locations: ["x"] },
    ]);
  });

  /**
   * The other half of the same door: a claim the registry marks prunable leaves
   * the wire without the caller asking. `nonce` is registered and prunable;
   * `empty_list` is not registered at all, so the two are stated together — the
   * prune must take exactly one.
   */
  test("should prune a registered empty claim from an opaque payload unasked", async () => {
    const { token } = await aegis.jws.sign({ kept: "value", nonce: "", empty_list: [] });

    const [, rawPayload] = token.split(".");

    expect(JSON.parse(B64.toString(rawPayload))).toEqual({
      kept: "value",
      empty_list: [],
    });
  });
});
