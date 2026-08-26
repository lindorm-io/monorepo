import { describe, expect, test } from "vitest";
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
});
