import { describe, expect, test } from "vitest";
import { subIdShape } from "./sub-id-shape.js";

describe("subIdShape", () => {
  test("passes when sub_id is absent", () => {
    expect(subIdShape({})).toEqual([]);
  });

  test("passes for a valid iss_sub format", () => {
    expect(
      subIdShape({ sub_id: { format: "iss_sub", iss: "https://x", sub: "s" } }),
    ).toEqual([]);
  });

  test("passes for an unknown format with only format", () => {
    expect(subIdShape({ sub_id: { format: "custom_format" } })).toEqual([]);
  });

  test("fails when sub_id is not an object", () => {
    expect(subIdShape({ sub_id: "x" })).toMatchSnapshot();
  });

  test("fails when format is missing", () => {
    expect(subIdShape({ sub_id: { iss: "x" } })).toMatchSnapshot();
  });

  test("fails when a required member of the format is missing", () => {
    expect(subIdShape({ sub_id: { format: "iss_sub", iss: "x" } })).toMatchSnapshot();
  });
});
