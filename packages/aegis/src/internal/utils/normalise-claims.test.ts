import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { normaliseClaims } from "./normalise-claims.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

describe("normaliseClaims", () => {
  // Strip 1: `undefined` is the absent property of a bag assembled from optional
  // fields. Every other value was written by someone, and only the registry says
  // which of those writings carry nothing.
  describe("the undefined strip", () => {
    test("should strip undefined and keep every other value of an unregistered key", () => {
      expect(
        normaliseClaims({ a: 1, b: null, c: "", d: undefined, e: [], f: {} }),
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

    // The `whenEmpty: "keep"` cells: a restriction (`aud`), a binding (`cnf`) and
    // the SET claims are statements.
    //
    // ⚠ `scope` is here and `roles` is not, though both are lists of granted
    // authority. AEGIS POLICY, not a citation: RFC 9068 §2.2.3 makes `scope` only
    // a SHOULD, so absence is indistinguishable from a grant that never had one,
    // which is what leaves an explicit empty list something to say. The lindorm
    // lists have a sole issuer that already emits empty as absence.
    test("should keep a registered claim the registry marks keepable", () => {
      expect(
        normaliseClaims({ aud: [], scope: [], cnf: {}, events: {}, sub: "user_1" }),
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
     * TOP LEVEL only. The registry reads an empty RFC 9396 `actions` (§2.2) as
     * granting no action, where an ABSENT one is not restricted by action at all
     * — the second half is aegis's inference, not the spec's words. The inner
     * members of a claim are its own declared structure and the registry
     * describes none of them, so recursion would invert a restriction one level
     * down.
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
  test("should not shred a nested opaque payload", async () => {
    const { token } = await aegis.jws.sign({ a: { b: { c: "" } }, keep: 1 });

    const [, rawPayload] = token.split(".");

    expect(JSON.parse(B64.toString(rawPayload))).toEqual({
      a: { b: { c: "" } },
      keep: 1,
    });
  });

  /**
   * RFC 9396 §2.2 defines `actions` as "An array of strings representing the
   * kinds of actions to be taken at the resource" and makes the permissions
   * requested "the product of all the values" — so an EMPTY `actions` array
   * grants no action at all. That an ABSENT one is instead not restricted by
   * action is the registry's own reading rather than the spec's words, and
   * dropping the empty array INVERTS the restriction: the most permissive
   * possible reading of a maximally restrictive statement. The registry's
   * `authorization_details` cell is what has to hold here, and it now holds on
   * every call rather than only on the ones that asked for a prune.
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
   * The other half of the same door, and the one the deleted mode used to gate:
   * a claim the registry marks prunable now leaves the wire without the caller
   * asking. `nonce` is registered and prunable; `empty_list` is not registered at
   * all, so the two are stated together — the prune must take exactly one.
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
