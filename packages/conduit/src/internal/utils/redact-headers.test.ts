import { describe, expect, test } from "vitest";
import {
  TEST_BASIC_CREDENTIAL,
  TEST_JWT,
  TEST_JWT_SIGNATURE,
  TEST_OPAQUE_TOKEN,
  TEST_PASSWORD,
} from "../../__fixtures__/tokens.js";
import { redactHeaderValue, redactHeaders, redactRawHeaders } from "./redact-headers.js";

describe("redactHeaders", () => {
  describe("authorization", () => {
    test("should keep scheme and strip the signature of a bearer token", () => {
      expect(redactHeaders({ Authorization: `Bearer ${TEST_JWT}` })).toMatchSnapshot();
    });

    test("should redact a bearer token on a lowercase header key", () => {
      expect(redactHeaders({ authorization: `Bearer ${TEST_JWT}` })).toMatchSnapshot();
    });

    test("should filter an opaque bearer token entirely", () => {
      expect(
        redactHeaders({ Authorization: `Bearer ${TEST_OPAQUE_TOKEN}` }),
      ).toMatchSnapshot();
    });

    test("should keep the username and filter the password of basic auth", () => {
      const result = redactHeaders({ Authorization: `Basic ${TEST_BASIC_CREDENTIAL}` });

      expect(result).toMatchSnapshot();
      expect(JSON.stringify(result)).not.toContain(TEST_PASSWORD);
    });

    test("should filter basic auth that does not decode", () => {
      expect(
        redactHeaders({ Authorization: "Basic !!!not-base64!!!" }),
      ).toMatchSnapshot();
    });

    test("should filter basic auth without a colon separator", () => {
      // B64.encode("nocolon")
      expect(redactHeaders({ Authorization: "Basic bm9jb2xvbg==" })).toMatchSnapshot();
    });

    test("should keep scheme and strip the signature of a dpop bound token", () => {
      expect(redactHeaders({ Authorization: `DPoP ${TEST_JWT}` })).toMatchSnapshot();
    });

    test("should filter an unknown scheme", () => {
      expect(redactHeaders({ Authorization: `Weird ${TEST_JWT}` })).toMatchSnapshot();
    });

    test("should filter a schemeless authorization header", () => {
      expect(redactHeaders({ Authorization: TEST_JWT })).toMatchSnapshot();
    });

    test("should filter a non-string authorization header", () => {
      expect(redactHeaders({ Authorization: 12345 })).toMatchSnapshot();
    });
  });

  describe("dpop", () => {
    test("should strip the signature of a dpop proof", () => {
      const result = redactHeaders({ DPoP: TEST_JWT });

      expect(result).toMatchSnapshot();
      expect(JSON.stringify(result)).not.toContain(TEST_JWT_SIGNATURE);
    });

    test("should strip the signature of a dpop proof on a lowercase header key", () => {
      expect(redactHeaders({ dpop: TEST_JWT })).toMatchSnapshot();
    });

    test("should filter a malformed dpop proof", () => {
      expect(redactHeaders({ DPoP: "not-a-proof" })).toMatchSnapshot();
    });
  });

  describe("cookie", () => {
    test("should keep cookie names and filter values", () => {
      expect(
        redactHeaders({ Cookie: "sid=abc123; theme=dark; csrf=xyz789" }),
      ).toMatchSnapshot();
    });

    test("should keep cookie names on a lowercase header key", () => {
      expect(redactHeaders({ cookie: "sid=abc123" })).toMatchSnapshot();
    });

    test("should filter a malformed cookie segment", () => {
      expect(redactHeaders({ cookie: "malformed" })).toMatchSnapshot();
    });

    test("should keep the name and attributes of a set-cookie string", () => {
      expect(
        redactHeaders({
          "set-cookie": "sid=abc123; Path=/; HttpOnly; SameSite=Strict",
        }),
      ).toMatchSnapshot();
    });

    test("should redact every entry of a set-cookie array", () => {
      expect(
        redactHeaders({
          "set-cookie": ["sid=abc123; Path=/; HttpOnly", "csrf=xyz789; Secure"],
        }),
      ).toMatchSnapshot();
    });

    test("should redact a capital-case Set-Cookie header", () => {
      expect(redactHeaders({ "Set-Cookie": "sid=abc123; Path=/" })).toMatchSnapshot();
    });
  });

  describe("passthrough", () => {
    test("should leave non-sensitive headers untouched", () => {
      expect(
        redactHeaders({
          "Content-Type": "application/json",
          "X-Correlation-Id": "corr_01HZ",
          "User-Agent": "conduit/1.0",
        }),
      ).toMatchSnapshot();
    });

    test("should return undefined for absent headers", () => {
      expect(redactHeaders(undefined)).toBeUndefined();
    });

    test("should not mutate the live headers object", () => {
      const headers = { Authorization: `Bearer ${TEST_JWT}` };

      redactHeaders(headers);

      expect(headers.Authorization).toEqual(`Bearer ${TEST_JWT}`);
    });
  });
});

describe("redactHeaderValue", () => {
  test("should redact by header name regardless of casing", () => {
    expect(redactHeaderValue("AUTHORIZATION", `Bearer ${TEST_JWT}`)).toMatchSnapshot();
    expect(redactHeaderValue(" DPoP ", TEST_JWT)).toMatchSnapshot();
  });
});

describe("redactRawHeaders", () => {
  test("should redact credentials in a raw header block", () => {
    const raw = [
      "POST /oauth/token HTTP/1.1",
      "Host: api.test.lindorm.io",
      "Content-Type: application/json",
      `Authorization: Bearer ${TEST_JWT}`,
      `DPoP: ${TEST_JWT}`,
      "Cookie: sid=abc123",
      "",
      "",
    ].join("\r\n");

    const result = redactRawHeaders(raw) as string;

    expect(result).toMatchSnapshot();
    expect(result).not.toContain(TEST_JWT_SIGNATURE);
  });

  test("should return a non-string as-is", () => {
    expect(redactRawHeaders(undefined)).toBeUndefined();
  });
});
