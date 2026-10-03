import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import type { SignContent } from "../../types/index.js";
import { CARRIERS, stripSensitiveClaims } from "./sensitive-content.js";

const NON_BAGS = [
  ["null", null],
  ["a string", "abc"],
  ["an array", ["x"]],
  ["an empty array", []],
] as const;

const strip = (carriers: Dict): SignContent =>
  stripSensitiveClaims({ subject: "user-1", ...carriers } as SignContent, [
    "nationalIdentityNumber",
  ]);

describe.each(CARRIERS)("stripSensitiveClaims on the %s carrier", (carrier) => {
  test("removes the carrier when the strip leaves it empty", () => {
    expect(
      strip({ [carrier]: { nationalIdentityNumber: "19900101-1234" } }),
    ).toMatchSnapshot();
  });

  test("removes the carrier when the strip leaves only a key holding undefined", () => {
    expect(
      strip({
        [carrier]: { nationalIdentityNumber: "19900101-1234", tenant: undefined },
      }),
    ).toMatchSnapshot();
  });

  test("keeps the non-sensitive neighbour of a claim it strips", () => {
    expect(
      strip({ [carrier]: { nationalIdentityNumber: "19900101-1234", tenant: "acme" } }),
    ).toMatchSnapshot();
  });

  test("removes the carrier when the caller wrote it as {}", () => {
    expect(strip({ [carrier]: {} })).toMatchSnapshot();
  });

  test("removes the carrier when the caller wrote only a key holding undefined", () => {
    expect(strip({ [carrier]: { tenant: undefined } })).toMatchSnapshot();
  });

  test.each(NON_BAGS)("passes a carrier holding %s through unchanged", (_, value) => {
    expect(strip({ [carrier]: value })).toMatchSnapshot();
  });
});
