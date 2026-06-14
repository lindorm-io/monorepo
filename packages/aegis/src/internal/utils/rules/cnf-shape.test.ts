import { describe, expect, test } from "vitest";
import { cnfShape } from "./cnf-shape.js";

// A real 32-byte SHA-256 digest, base64url-encoded.
const VALID_JKT = "LXEWQrcmsEQBYnyp-6wy9chTD7GQPMTbAiWHF5IaSIE";

describe("cnfShape", () => {
  test("passes when cnf is absent", () => {
    expect(cnfShape({})).toEqual([]);
  });

  test("passes for a valid jkt thumbprint", () => {
    expect(cnfShape({ cnf: { jkt: VALID_JKT } })).toEqual([]);
  });

  test("fails when cnf is not an object", () => {
    expect(cnfShape({ cnf: "x" })).toMatchSnapshot();
  });

  test("fails on an unknown cnf member", () => {
    expect(cnfShape({ cnf: { jkt: VALID_JKT, surprise: true } })).toMatchSnapshot();
  });

  test("fails when jkt is the wrong byte length", () => {
    expect(cnfShape({ cnf: { jkt: "YWJj" } })).toMatchSnapshot();
  });
});
