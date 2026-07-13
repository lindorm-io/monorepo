import { describe, expect, test } from "vitest";
import { redactAuthorization } from "./redact-authorization.js";

const basic = (credential: string): string =>
  `Basic ${Buffer.from(credential).toString("base64")}`;

describe("redactAuthorization", () => {
  describe("bearer / dpop", () => {
    test("should keep the header and payload of a bearer token, dropping the signature", () => {
      expect(redactAuthorization("Bearer header.payload.signature")).toMatchSnapshot();
    });

    test("should keep the header and payload of a dpop token, dropping the signature", () => {
      expect(redactAuthorization("DPoP header.payload.signature")).toMatchSnapshot();
    });

    test("should preserve the scheme as received", () => {
      expect(redactAuthorization("bearer header.payload.signature")).toMatchSnapshot();
    });

    test("should filter an opaque bearer token", () => {
      expect(redactAuthorization("Bearer opaque-token")).toMatchSnapshot();
    });
  });

  describe("basic", () => {
    test("should keep the username and filter the password", () => {
      expect(redactAuthorization(basic("admin:secret"))).toMatchSnapshot();
    });

    test("should filter a password containing colons in full", () => {
      const redacted = redactAuthorization(basic("admin:pa:ss:word"));

      expect(redacted).toMatchSnapshot();
      expect(redacted).not.toContain("pa:ss:word");
      expect(redacted).not.toContain("ss");
    });

    test("should filter credentials with no colon", () => {
      expect(redactAuthorization(basic("nocolonhere"))).toMatchSnapshot();
    });

    test("should filter credentials that do not decode to username:password", () => {
      expect(redactAuthorization("Basic !!!not-base64!!!")).toMatchSnapshot();
    });
  });

  describe("fail closed", () => {
    test.each(["Unknown credential", "Negotiate abcdef", "Bearer", "just-a-value", ""])(
      "should filter unparseable authorization: %p",
      (input) => {
        expect(redactAuthorization(input)).toBe("[Filtered]");
      },
    );

    test.each([undefined, null, 0, true, {}, []])(
      "should filter non-string input: %p",
      (input) => {
        expect(redactAuthorization(input)).toBe("[Filtered]");
      },
    );
  });
});
