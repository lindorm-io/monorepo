import { describe, expect, test } from "vitest";
import { actChainShape } from "./act-chain-shape.js";

describe("actChainShape", () => {
  test("passes when act/may_act are absent", () => {
    expect(actChainShape({})).toEqual([]);
  });

  test("passes for a valid nested act chain", () => {
    expect(
      actChainShape({
        act: { sub: "a", act: { sub: "b", client_id: "c" } },
      }),
    ).toEqual([]);
  });

  test("fails when act is not an object", () => {
    expect(actChainShape({ act: "x" })).toMatchSnapshot();
  });

  test("fails on an unknown member and a non-string sub", () => {
    expect(actChainShape({ act: { sub: 1, surprise: true } })).toMatchSnapshot();
  });

  test("fails on a malformed nested act", () => {
    expect(actChainShape({ may_act: { sub: "a", act: { iss: 5 } } })).toMatchSnapshot();
  });
});
