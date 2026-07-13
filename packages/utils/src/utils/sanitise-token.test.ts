import { describe, expect, test } from "vitest";
import { sanitiseToken } from "./sanitise-token.js";

describe("sanitiseToken", () => {
  test("should keep header and payload of a jws / jwt, dropping the signature", () => {
    expect(sanitiseToken("header.payload.signature")).toMatchSnapshot();
  });

  test("should keep only the protected header of a jwe", () => {
    expect(sanitiseToken("header.key.iv.content.tag")).toMatchSnapshot();
  });

  test("should filter an opaque token without dots", () => {
    expect(sanitiseToken("opaque-token-value")).toMatchSnapshot();
  });

  test("should filter a malformed two part token", () => {
    expect(sanitiseToken("header.payload")).toMatchSnapshot();
  });

  test("should filter a malformed four part token", () => {
    expect(sanitiseToken("header.key.iv.content")).toMatchSnapshot();
  });

  test("should filter an empty string", () => {
    expect(sanitiseToken("")).toMatchSnapshot();
  });

  test.each([undefined, null, 0, 1, true, false, {}, [], new Date()])(
    "should filter non-string input: %p",
    (input) => {
      expect(sanitiseToken(input)).toBe("[Filtered]");
    },
  );
});
