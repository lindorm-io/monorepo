import { describe, expect, test } from "vitest";
import { formatContextConstructorFailure } from "./format-context-constructor-failure.js";

describe("formatContextConstructorFailure", () => {
  test("should name the token and preserve the original message verbatim", () => {
    expect(
      formatContextConstructorFailure({
        className: "AesContext",
        message: "no kms endpoint configured",
      }),
    ).toMatchSnapshot();
  });
});
