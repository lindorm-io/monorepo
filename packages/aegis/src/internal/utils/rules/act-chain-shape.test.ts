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

  test("fails on an unknown member and a non-string sub", () => {
    expect(actChainShape({ act: { subject: 1, surprise: true } })).toMatchSnapshot();
  });

  test("fails on a malformed nested act", () => {
    expect(
      actChainShape({ mayAct: { subject: "a", act: { issuer: 5 } } }),
    ).toMatchSnapshot();
  });
});
