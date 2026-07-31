import { describe, expect, test } from "vitest";
import { RedirectError } from "./RedirectError.js";

describe("RedirectError", () => {
  test("should expose all optional fields when provided", () => {
    const error = new RedirectError("redirect message", {
      redirect: "https://lindorm.io/callback",
      state: "state_value",
      uri: "https://lindorm.io/errors/access_denied",
      issuer: "https://lindorm.io",
    });

    expect(error.redirect).toEqual("https://lindorm.io/callback");
    expect(error.state).toEqual("state_value");
    expect(error.uri).toEqual("https://lindorm.io/errors/access_denied");
    expect(error.issuer).toEqual("https://lindorm.io");
  });

  test("should leave optional fields undefined when omitted", () => {
    const error = new RedirectError("redirect message", {
      redirect: "https://lindorm.io/callback",
    });

    expect(error.redirect).toEqual("https://lindorm.io/callback");
    expect(error.state).toBeUndefined();
    expect(error.uri).toBeUndefined();
    expect(error.issuer).toBeUndefined();
  });
});
