import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import type { SignContext } from "../../../types/index.js";
import { requiredWhen } from "./required-when.js";

// The context is a CLOSED record, so this predicate cannot read a key that does
// not exist — `context.accessTokenIssud` would not compile.
const rule = {
  claim: "accessTokenHash",
  when: (_claims: Dict, context: SignContext) => context.accessTokenIssued === true,
};

describe("requiredWhen", () => {
  test("no entry when the predicate is false", () => {
    expect(requiredWhen({}, { accessTokenIssued: false }, rule)).toEqual([]);
  });

  test("no entry when the claim is already present", () => {
    expect(
      requiredWhen({ accessTokenHash: "h" }, { accessTokenIssued: true }, rule),
    ).toEqual([]);
  });

  test("entry when the predicate is true and the claim is missing", () => {
    expect(requiredWhen({}, { accessTokenIssued: true }, rule)).toMatchSnapshot();
  });

  // An empty-string hash is not a hash; it must count as missing, or a caller
  // could satisfy the requirement by carrying nothing under the right name.
  test("entry when the claim is present but empty", () => {
    expect(
      requiredWhen({ accessTokenHash: "" }, { accessTokenIssued: true }, rule),
    ).toMatchSnapshot();
  });
});
