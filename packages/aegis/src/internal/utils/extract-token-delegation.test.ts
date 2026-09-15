import { extractTokenDelegation } from "./extract-token-delegation.js";
import { describe, expect, test } from "vitest";

describe("extractTokenDelegation", () => {
  test("should return undelegated state when no act claim is present", () => {
    expect(extractTokenDelegation({})).toMatchSnapshot();
  });

  test("should return single-level actor chain", () => {
    expect(
      extractTokenDelegation({
        act: { sub: "service-1", iss: "https://issuer.example/" },
      }),
    ).toMatchSnapshot();
  });

  test("should report no audience for an actor whose wire carried one", () => {
    // ⛔ AEGIS DECLARES NO AUDIENCE MEMBER INSIDE AN ACTOR
    // (`internal/claims/act-members.ts`, RFC 8693 §4.1), so this summary has none
    // to fill and a foreign `act.aud` is not translated into one here. Untouched,
    // it is reported in the ACTOR'S OWN TAIL — `VerifiedToken.claims.act`, not
    // this derived summary:
    // `__fixtures__/scenarios.ts#a-foreign-actors-audience-is-reported-in-the-tail-untranslated`.
    //
    // ⚠ Asserted inline rather than by snapshot: the point is which members the
    // summary carries and no others, and a snapshot written under a walk that had
    // already gained one would record the gain as the expectation.
    expect(
      extractTokenDelegation({ act: { sub: "service-1", aud: ["https://rs.test"] } })
        .actorChain,
    ).toEqual([{ subject: "service-1" }]);
  });

  test("should walk three-level nested act chain outermost to deepest", () => {
    expect(
      extractTokenDelegation({
        act: {
          sub: "service-1",
          act: {
            sub: "service-2",
            act: {
              sub: "service-3",
            },
          },
        },
      }),
    ).toMatchSnapshot();
  });
});
