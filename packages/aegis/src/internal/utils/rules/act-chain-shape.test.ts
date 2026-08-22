import { describe, expect, test } from "vitest";
import { actChainShape } from "./act-chain-shape.js";

describe("actChainShape", () => {
  test("passes when act/may_act are absent", () => {
    expect(actChainShape({})).toEqual([]);
  });

  test("passes for a valid nested act chain", () => {
    expect(
      actChainShape({
        act: { subject: "a", act: { subject: "b", clientId: "c" } },
      }),
    ).toEqual([]);
  });

  test("fails when act is not an object", () => {
    expect(actChainShape({ act: "x" })).toMatchSnapshot();
  });

  test("fails on a non-string sub", () => {
    expect(actChainShape({ act: { subject: 1 } })).toMatchSnapshot();
  });

  test("fails on a non-string clientId — the third member, and the unpinned one", () => {
    // ⛔ THE MEMBER THE RULE NAMED AND NOTHING CHECKED. `STRING_MEMBERS` is
    // `["subject", "issuer", "clientId"]`; `subject` and `issuer` each have a
    // negative case, `clientId` had only the PASSING chain above. Measured:
    // dropping `"clientId"` from the list reddened nothing.
    //
    // ⚠ Asserted inline rather than by snapshot, because the point is the exact
    // member name and message — a snapshot written under a rule that had already
    // lost the member would record the loss as the expectation.
    expect(actChainShape({ act: { clientId: 42 } })).toEqual([
      { key: "act.clientId", message: '"act.clientId" must be a string' },
    ]);
  });

  test("says NOTHING about a member the registry does not declare", () => {
    // ⚠ The registry declares the actor member set OPEN (RFC 8693 §4.1,
    // RFC 8693 §4.4), so an undeclared member is CARRIED — by this rule's silence
    // and by the structure walker alike. Asserted rather than left implicit,
    // because otherwise a reader finds the silence, assumes an oversight, and
    // re-adds an allowlist the specification forbids.
    expect(actChainShape({ act: { subject: "a", surprise: true } })).toEqual([]);
  });

  // ⚠⚠ THESE THREE ROWS ARE THE AUDIENCE RULE'S ONLY COVERAGE: without them,
  // deleting its call site leaves the whole package suite green.
  test("accepts an actor audience in either form RFC 7519 §4.1.3 permits", () => {
    // BOTH forms are conformant (RFC 7519 §4.1.3), so a rule refusing either
    // would refuse tokens the specification allows.
    expect(actChainShape({ act: { audience: "https://rs.test" } })).toEqual([]);
    expect(
      actChainShape({ act: { audience: ["https://rs.test", "https://b.test"] } }),
    ).toEqual([]);
  });

  test("fails on an actor audience that is neither a string nor an array", () => {
    expect(actChainShape({ act: { audience: 42 } })).toMatchSnapshot();
  });

  test("fails on an actor audience array holding something that is not a string", () => {
    // The half `isArray` alone could not see: the message promises "array of
    // strings", and an array of numbers satisfied the predicate while
    // contradicting the message.
    expect(actChainShape({ act: { audience: [1, 2] } })).toMatchSnapshot();
  });

  test("fails on a malformed nested act", () => {
    expect(
      actChainShape({ mayAct: { subject: "a", act: { issuer: 5 } } }),
    ).toMatchSnapshot();
  });
});
