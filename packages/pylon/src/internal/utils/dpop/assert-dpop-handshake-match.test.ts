import { ClientError } from "@lindorm/errors";
import { assertDpopHandshakeMatch } from "./assert-dpop-handshake-match.js";
import { describe, expect, test } from "vitest";

describe("assertDpopHandshakeMatch", () => {
  const handshake: any = {
    secure: true,
    headers: { host: "api.example.com" },
    url: "/socket.io/?token=abc",
  };

  test("accepts valid proof against the upgrade URL with htm=GET", () => {
    expect(() =>
      assertDpopHandshakeMatch(handshake, {
        httpMethod: "GET",
        httpUri: "https://api.example.com/socket.io/",
      }),
    ).not.toThrow();
  });

  test("strips query from handshake url (match succeeds without query)", () => {
    expect(() =>
      assertDpopHandshakeMatch(
        { ...handshake, url: "/socket.io/?token=abc&other=1" },
        {
          httpMethod: "GET",
          httpUri: "https://api.example.com/socket.io/",
        },
      ),
    ).not.toThrow();
  });

  test("rejects when path does not match", () => {
    expect(() =>
      assertDpopHandshakeMatch(handshake, {
        httpMethod: "GET",
        httpUri: "https://api.example.com/other/",
      }),
    ).toThrow(ClientError);
  });

  test("rejects non-GET htm", () => {
    expect(() =>
      assertDpopHandshakeMatch(handshake, {
        httpMethod: "POST",
        httpUri: "https://api.example.com/socket.io/",
      }),
    ).toThrow(ClientError);
  });

  test("honors x-forwarded-proto / x-forwarded-host for origin reconstruction", () => {
    expect(() =>
      assertDpopHandshakeMatch(
        {
          secure: false,
          headers: {
            host: "internal:8080",
            "x-forwarded-proto": "https",
            "x-forwarded-host": "api.example.com",
          },
          url: "/socket.io/",
        },
        {
          httpMethod: "GET",
          httpUri: "https://api.example.com/socket.io/",
        },
      ),
    ).not.toThrow();
  });

  test("rejects when host header is missing", () => {
    expect(() =>
      assertDpopHandshakeMatch(
        { secure: true, headers: {}, url: "/socket.io/" },
        {
          httpMethod: "GET",
          httpUri: "https://api.example.com/socket.io/",
        },
      ),
    ).toThrow(ClientError);
  });
});
