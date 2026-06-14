import { describe, expect, test } from "vitest";
import { issUri } from "./iss-uri.js";

describe("issUri", () => {
  test("passes when iss is absent", () => {
    expect(issUri({})).toEqual([]);
  });

  test("passes for a URL issuer", () => {
    expect(issUri({ iss: "https://test.lindorm.io/" })).toEqual([]);
  });

  test("fails for a non-URI issuer", () => {
    expect(issUri({ iss: "not a uri" })).toMatchSnapshot();
  });
});
