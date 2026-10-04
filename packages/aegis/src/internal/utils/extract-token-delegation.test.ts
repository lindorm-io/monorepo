import { extractTokenDelegation } from "./extract-token-delegation.js";
import { describe, expect, test } from "vitest";

describe("extractTokenDelegation", () => {
  test("should return undelegated state when no act claim is present", () => {
    expect(extractTokenDelegation(undefined)).toMatchSnapshot();
  });

  test("should return single-level actor chain", () => {
    expect(
      extractTokenDelegation({ subject: "service-1", issuer: "https://issuer.example/" }),
    ).toMatchSnapshot();
  });

  test("should report no audience for an actor whose wire carried one", () => {
    // ⛔ AEGIS DECLARES NO AUDIENCE MEMBER INSIDE AN ACTOR
    // (`internal/claims/act-members.ts`, RFC 8693 §4.1), so a foreign `act.aud`
    // arrives in the DECODED actor claim on its open tail, under its own name —
    // and this summary has no member to translate it into. Untouched, it is
    // reported in the ACTOR'S OWN TAIL — `VerifiedToken.claims.act`, not this
    // derived summary:
    // `Aegis.delegation.feature` "a verify reports a foreign token's actor `aud`
    // under the name its issuer wrote".
    //
    // ⚠ Asserted inline rather than by snapshot: the point is which members the
    // summary carries and no others, and a snapshot written under a walk that had
    // already gained one would record the gain as the expectation.
    expect(
      extractTokenDelegation({ subject: "service-1", aud: ["https://rs.test"] })
        .actorChain,
    ).toEqual([{ subject: "service-1" }]);
  });

  test("should walk three-level nested act chain outermost to deepest", () => {
    expect(
      extractTokenDelegation({
        subject: "service-1",
        act: {
          subject: "service-2",
          act: {
            subject: "service-3",
          },
        },
      }),
    ).toMatchSnapshot();
  });
});
