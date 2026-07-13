import { describe, expect, test } from "vitest";
import { redactHeaders } from "./redact-headers.js";

describe("redactHeaders", () => {
  test("should redact authorization, dpop and cookie while passing everything else through", () => {
    expect(
      redactHeaders({
        accept: "application/json",
        authorization: "Bearer header.payload.signature",
        cookie: "sid=abc123; theme=dark",
        dpop: "proofheader.proofpayload.proofsignature",
        "user-agent": "lindorm/1.0",
      }),
    ).toMatchSnapshot();
  });

  test("should redact the set-cookie response header", () => {
    expect(
      redactHeaders({
        "content-type": "application/json",
        "set-cookie": ["sid=abc123; Path=/; HttpOnly"],
      }),
    ).toMatchSnapshot();
  });

  test("should redact regardless of header key casing", () => {
    expect(
      redactHeaders({
        Authorization: "Bearer header.payload.signature",
        Cookie: "sid=abc123",
        DPoP: "proofheader.proofpayload.proofsignature",
      }),
    ).toMatchSnapshot();
  });

  test("should not mutate the live header object", () => {
    const headers = {
      authorization: "Bearer header.payload.signature",
      cookie: "sid=abc123",
    };

    const redacted = redactHeaders(headers);

    expect(headers.authorization).toBe("Bearer header.payload.signature");
    expect(headers.cookie).toBe("sid=abc123");
    expect(redacted).not.toBe(headers);
  });

  test("should leak neither the signature nor the cookie value", () => {
    const serialised = JSON.stringify(
      redactHeaders({
        authorization: "Bearer header.payload.signature",
        cookie: "sid=abc123",
        dpop: "proofheader.proofpayload.proofsignature",
      }),
    );

    expect(serialised).not.toContain("signature");
    expect(serialised).not.toContain("proofsignature");
    expect(serialised).not.toContain("abc123");
  });

  test.each([undefined, null, "request.header", 0])(
    "should return an empty object for non-object input: %p",
    (input) => {
      expect(redactHeaders(input)).toEqual({});
    },
  );
});
