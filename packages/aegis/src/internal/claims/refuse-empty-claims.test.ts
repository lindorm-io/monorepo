import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { AegisDomainError } from "../../errors/index.js";
import { CLAIM_SPECS, coseName, joseName } from "./claims-registry.js";
import { refuseEmptyClaims } from "./refuse-empty-claims.js";

/**
 * The claims-side emission refusal — the payload twin of
 * `internal/header/refuse-empty-headers.ts`, and the sibling of
 * `prune-empty-claims.ts` over the same `whenEmpty` column.
 */
describe("refuseEmptyClaims", () => {
  /**
   * ⭐ THE STRUCTURAL ASSERTION, and it is derived rather than listed — the cell
   * decides which branch a claim takes, so a cell flipped in the registry moves
   * its row here with no edit to this file. The guard reads ONE column and refuses
   * on ONE answer, so widening its comparison to "anything but prune" or "anything
   * but keep" turns a whole registry into a refusal — which is what this walk goes
   * red on, per claim, by name.
   */
  test.each(CLAIM_SPECS)(
    "$domain's $whenEmpty cell decides its empty value — refuse throws by domain name, keep and prune pass through",
    (spec) => {
      for (const key of [joseName(spec), coseName(spec)]) {
        const emit = () => refuseEmptyClaims({ [key]: [] });

        if (spec.whenEmpty !== "refuse") {
          expect(emit).not.toThrow();
          continue;
        }

        // ⚠ `AegisDomainError`, not `AegisError`: the subclass extends the base, so
        // the base cannot tell the profile floor's class from any other aegis error.
        expect(emit).toThrow(AegisDomainError);
        expect(emit).toThrow(
          expect.objectContaining({
            code: "claim_empty_value",
            // The DOMAIN name, never the wire key this call was made with — the
            // floor and the emission boundary owe a caller one vocabulary.
            data: expect.objectContaining({ claim: spec.domain }),
          }),
        );
      }
    },
  );

  test("a claim the registry KEEPS when empty passes through", () => {
    // `aud: []` names no audience and `scope: []` grants nothing, and both are
    // statements the registry carries to the wire — a refusal here would delete
    // the one verdict that puts an empty value on a signed token.
    expect(() => refuseEmptyClaims({ aud: [], scope: [] })).not.toThrow();
  });

  test("a claim the registry PRUNES when empty passes through — the refusal is not the prune", () => {
    expect(() => refuseEmptyClaims({ nonce: "", amr: [] })).not.toThrow();
  });

  test("an UNREGISTERED key is never refused, however empty", () => {
    // aegis does not judge what it has not declared — the same rule that keeps the
    // opaque and raw kit-sign doors honest.
    expect(() => refuseEmptyClaims({ mine: "", other: [], empty_map: {} })).not.toThrow();
  });

  test("a real value passes", () => {
    expect(() =>
      refuseEmptyClaims({ iss: "https://i/", sub: "u1", amr: ["pwd"] }),
    ).not.toThrow();
  });

  /**
   * ⭐ THE RAW DOORS, where the cell bites with no profile above it. `aegis.jws.sign`
   * and `aegis.cws.sign` run the shared normalisation on an object payload
   * (`internal/utils/raw-sign-jws.ts`, `internal/utils/raw-sign-cose.ts`) — the
   * twin of `refuse-empty-headers.test.ts`'s untyped-caller row. Both wires: the
   * normalisation runs upstream of either encoding, and a refusal present on one
   * wire alone is a verdict the caller picks by encoding.
   */
  describe("the raw doors", () => {
    let logger: ILogger;
    let amphora: IAmphora;
    let aegis: Aegis;

    beforeEach(async () => {
      MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

      logger = createMockLogger();
      amphora = new Amphora({ internal: { issuer: "https://test.lindorm.io/" }, logger });
      aegis = new Aegis({ amphora, logger });

      await amphora.setup();

      amphora.add(TEST_EC_KEY_SIG);
    });

    const REFUSAL = expect.objectContaining({
      code: "claim_empty_value",
      data: { claim: "confirmation", whenEmpty: "refuse" },
    });

    test("an empty confirmation is refused identically on both wires", async () => {
      await expect(aegis.jws.sign({ cnf: {} })).rejects.toThrow(AegisDomainError);
      await expect(aegis.jws.sign({ cnf: {} })).rejects.toThrow(REFUSAL);

      await expect(aegis.cws.sign({ cnf: {} })).rejects.toThrow(AegisDomainError);
      await expect(aegis.cws.sign({ cnf: {} })).rejects.toThrow(REFUSAL);
    });

    // The control: the same doors still take a payload the cell says nothing about.
    test("the same doors sign a payload with no refused claim", async () => {
      await expect(
        aegis.jws.sign({ cnf: { kid: "key-1" }, scope: [] }),
      ).resolves.toBeDefined();
      await expect(
        aegis.cws.sign({ cnf: { kid: "key-1" }, scope: [] }),
      ).resolves.toBeDefined();
    });

    /**
     * The STRUCTURED raw doors take the same normalisation: `JwtKit.sign`
     * (`classes/JwtKit.ts`) and `internal/cose/sign-cwt.ts` both call
     * `normaliseClaims` on the already-wire claims. On COSE it runs BEFORE the
     * claim codec, so the answer is the emission boundary's `claim_empty_value`
     * and never `encodeCnf`'s `cose_cnf_unsupported` (`internal/cose/cose-key.ts`).
     */
    test("an empty confirmation is refused on jwt.sign by the emission boundary", async () => {
      await expect(aegis.jwt.sign({ cnf: {} })).rejects.toThrow(AegisDomainError);
      await expect(aegis.jwt.sign({ cnf: {} })).rejects.toThrow(REFUSAL);
    });

    test("an empty confirmation is refused on cwt.sign by the emission boundary, ahead of the COSE cnf codec", async () => {
      await expect(aegis.cwt.sign({ cnf: {} })).rejects.toThrow(AegisDomainError);
      await expect(aegis.cwt.sign({ cnf: {} })).rejects.toThrow(REFUSAL);
    });

    /**
     * The emptiness the door asks about is `isClaimSatisfied`'s
     * (`internal/utils/rules/is-claim-satisfied.ts`): `[]` names no key exactly
     * as `{}` does.
     */
    test("a confirmation that is an empty array is refused at every raw door", async () => {
      const cnf: Array<never> = [];

      await expect(aegis.jws.sign({ cnf })).rejects.toThrow(REFUSAL);
      await expect(aegis.cws.sign({ cnf })).rejects.toThrow(REFUSAL);
      await expect(aegis.jwt.sign({ cnf } as Dict)).rejects.toThrow(REFUSAL);
      await expect(aegis.cwt.sign({ cnf } as Dict)).rejects.toThrow(REFUSAL);
    });
  });
});
