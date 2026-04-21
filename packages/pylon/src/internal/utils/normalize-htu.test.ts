import { normalizeHtu } from "./normalize-htu";
import { describe, expect, test } from "vitest";

describe("normalizeHtu", () => {
  test("should return a normalized origin + path", () => {
    expect(normalizeHtu("https://api.example.com", "/orders")).toEqual(
      "https://api.example.com/orders",
    );
  });

  test("should lowercase scheme and host", () => {
    expect(normalizeHtu("HTTPS://API.EXAMPLE.COM", "/orders")).toEqual(
      "https://api.example.com/orders",
    );
  });

  test("should strip default port 443 for https", () => {
    expect(normalizeHtu("https://api.example.com:443", "/orders")).toEqual(
      "https://api.example.com/orders",
    );
  });

  test("should strip default port 80 for http", () => {
    expect(normalizeHtu("http://api.example.com:80", "/orders")).toEqual(
      "http://api.example.com/orders",
    );
  });

  test("should preserve non-default port", () => {
    expect(normalizeHtu("https://api.example.com:8443", "/orders")).toEqual(
      "https://api.example.com:8443/orders",
    );
  });

  test("should accept a full URL passed as origin with empty path", () => {
    expect(normalizeHtu("https://api.example.com/orders", "")).toEqual(
      "https://api.example.com/orders",
    );
  });
});
