import { redactHeaders } from "./redact-headers";

describe("redactHeaders", () => {
  test("redacts Authorization header", () => {
    const headers = {
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    };

    const result = redactHeaders(headers);

    expect(result).toEqual({
      Authorization: "[REDACTED]",
      "Content-Type": "application/json",
    });
  });

  test("redacts Cookie header", () => {
    const headers = {
      Cookie: "session=abc123; token=xyz789",
      "Content-Type": "application/json",
    };

    const result = redactHeaders(headers);

    expect(result).toEqual({
      Cookie: "[REDACTED]",
      "Content-Type": "application/json",
    });
  });

  test("redacts Set-Cookie header", () => {
    const headers = {
      "Set-Cookie": "session=abc123; HttpOnly; Secure",
      "Content-Type": "application/json",
    };

    const result = redactHeaders(headers);

    expect(result).toEqual({
      "Set-Cookie": "[REDACTED]",
      "Content-Type": "application/json",
    });
  });

  test("redacts Proxy-Authorization header", () => {
    const headers = {
      "Proxy-Authorization": "Basic dXNlcjpwYXNz",
      "Content-Type": "application/json",
    };

    const result = redactHeaders(headers);

    expect(result).toEqual({
      "Proxy-Authorization": "[REDACTED]",
      "Content-Type": "application/json",
    });
  });

  test("redacts case variations (AUTHORIZATION, set-cookie)", () => {
    const headers = {
      AUTHORIZATION: "Bearer secret",
      "set-cookie": "session=abc",
      CoOkIe: "token=xyz",
      "PROXY-AUTHORIZATION": "Basic xyz",
      "Content-Type": "application/json",
    };

    const result = redactHeaders(headers);

    expect(result).toEqual({
      AUTHORIZATION: "[REDACTED]",
      "set-cookie": "[REDACTED]",
      CoOkIe: "[REDACTED]",
      "PROXY-AUTHORIZATION": "[REDACTED]",
      "Content-Type": "application/json",
    });
  });

  test("preserves non-sensitive headers unchanged", () => {
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "conduit/1.0",
      Accept: "application/json",
      "X-Custom-Header": "custom-value",
    };

    const result = redactHeaders(headers);

    expect(result).toEqual(headers);
  });

  test("does not mutate the original headers object", () => {
    const headers = {
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    };

    const original = { ...headers };

    redactHeaders(headers);

    expect(headers).toEqual(original);
  });

  test("handles empty headers object", () => {
    const result = redactHeaders({});

    expect(result).toEqual({});
  });

  test("redacts all sensitive headers in one call", () => {
    const headers = {
      Authorization: "Bearer token",
      Cookie: "session=abc",
      "Set-Cookie": "token=xyz",
      "Proxy-Authorization": "Basic auth",
      "Content-Type": "application/json",
      "X-Custom": "value",
    };

    const result = redactHeaders(headers);

    expect(result).toEqual({
      Authorization: "[REDACTED]",
      Cookie: "[REDACTED]",
      "Set-Cookie": "[REDACTED]",
      "Proxy-Authorization": "[REDACTED]",
      "Content-Type": "application/json",
      "X-Custom": "value",
    });
  });
});
