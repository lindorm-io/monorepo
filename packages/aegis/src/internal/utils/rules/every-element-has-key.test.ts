import { describe, expect, test } from "vitest";
import { everyElementHasKey } from "./every-element-has-key.js";

describe("everyElementHasKey", () => {
  test("passes when claim is absent", () => {
    expect(everyElementHasKey({}, "authorization_details", "type")).toEqual([]);
  });

  test("passes when every element has the key", () => {
    expect(
      everyElementHasKey(
        { authorization_details: [{ type: "a" }, { type: "b" }] },
        "authorization_details",
        "type",
      ),
    ).toEqual([]);
  });

  test("fails when the claim is not an array", () => {
    expect(
      everyElementHasKey({ authorization_details: {} }, "authorization_details", "type"),
    ).toMatchSnapshot();
  });

  test("fails when an element lacks the key", () => {
    expect(
      everyElementHasKey(
        { authorization_details: [{ type: "a" }, { other: 1 }] },
        "authorization_details",
        "type",
      ),
    ).toMatchSnapshot();
  });

  // RFC 9396 §2 — `type` "determines the allowable contents of the object", so
  // an element typed `""` names nothing a resource server can match against. The
  // member is a demand, and an empty value does not satisfy one.
  test("fails when an element's key is an empty string", () => {
    expect(
      everyElementHasKey(
        { authorization_details: [{ type: "a" }, { type: "" }] },
        "authorization_details",
        "type",
      ),
    ).toMatchSnapshot();
  });
});
