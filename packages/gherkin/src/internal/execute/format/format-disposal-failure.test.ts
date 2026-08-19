import { describe, expect, test } from "vitest";
import { formatDisposalFailure } from "./format-disposal-failure.js";

describe("formatDisposalFailure", () => {
  test("should name the context class and preserve the original message verbatim", () => {
    expect(
      formatDisposalFailure({
        className: "AesContext",
        message: "connection already closed",
      }),
    ).toMatchSnapshot();
  });
});
