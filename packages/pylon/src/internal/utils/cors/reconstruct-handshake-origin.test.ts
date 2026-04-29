import { reconstructHandshakeOrigin } from "./reconstruct-handshake-origin.js";
import { describe, expect, test } from "vitest";

describe("reconstructHandshakeOrigin", () => {
  test("should use http when handshake is not secure", () => {
    expect(
      reconstructHandshakeOrigin({
        secure: false,
        headers: { host: "api.example.com" },
      } as any),
    ).toBe("http://api.example.com");
  });

  test("should use https when handshake is secure", () => {
    expect(
      reconstructHandshakeOrigin({
        secure: true,
        headers: { host: "api.example.com" },
      } as any),
    ).toBe("https://api.example.com");
  });

  test("should honour x-forwarded-proto", () => {
    expect(
      reconstructHandshakeOrigin({
        secure: false,
        headers: {
          host: "api.example.com",
          "x-forwarded-proto": "https",
        },
      } as any),
    ).toBe("https://api.example.com");
  });

  test("should honour x-forwarded-host", () => {
    expect(
      reconstructHandshakeOrigin({
        secure: false,
        headers: {
          host: "internal.local",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "api.example.com",
        },
      } as any),
    ).toBe("https://api.example.com");
  });

  test("should take first value of comma-separated x-forwarded-* headers", () => {
    expect(
      reconstructHandshakeOrigin({
        secure: false,
        headers: {
          host: "internal.local",
          "x-forwarded-proto": "https, http",
          "x-forwarded-host": "api.example.com, other.example.com",
        },
      } as any),
    ).toBe("https://api.example.com");
  });

  test("should return undefined when host is missing", () => {
    expect(
      reconstructHandshakeOrigin({
        secure: true,
        headers: {},
      } as any),
    ).toBeUndefined();
  });
});
