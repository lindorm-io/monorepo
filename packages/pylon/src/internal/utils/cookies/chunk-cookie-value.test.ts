import { chunkCookieValue } from "./chunk-cookie-value.js";
import { describe, expect, test } from "vitest";

describe("chunkCookieValue", () => {
  const baseOptions = {
    domain: "lindorm.io",
    httpOnly: true,
    sameSite: "strict" as const,
    secure: true,
  };

  test("should return single un-chunked cookie when value fits under threshold", () => {
    expect(
      chunkCookieValue({
        name: "session",
        value: "short_value",
        options: baseOptions,
        chunkSize: 4000,
      }),
    ).toMatchSnapshot();
  });

  test("should keep bare name (no .0 suffix) for backwards-compatibility under threshold", () => {
    const result = chunkCookieValue({
      name: "session",
      value: "x".repeat(100),
      options: baseOptions,
      chunkSize: 4000,
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("session");
  });

  test("should chunk an oversized value into .0, .1, ... entries", () => {
    const value = "x".repeat(10_000);

    const chunks = chunkCookieValue({
      name: "session",
      value,
      options: baseOptions,
      chunkSize: 4000,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].name).toBe("session.0");
    expect(chunks[1].name).toBe("session.1");
    expect(chunks.map((c) => c.value).join("")).toBe(value);
  });

  test("should not exceed chunkSize for any rendered chunk", async () => {
    const { PylonCookie } = await import("../../classes/PylonCookie.js");
    const value = "x".repeat(10_000);
    const chunkSize = 4000;

    const chunks = chunkCookieValue({
      name: "session",
      value,
      options: baseOptions,
      chunkSize,
    });

    for (const chunk of chunks) {
      const rendered = new PylonCookie(chunk.name, chunk.value, baseOptions).toHeader();
      expect(rendered.length).toBeLessThanOrEqual(chunkSize);
    }
  });

  test("should round-trip exactly at the chunk boundary", () => {
    const value = "x".repeat(4096);

    const chunks = chunkCookieValue({
      name: "session",
      value,
      options: baseOptions,
      chunkSize: 4000,
    });

    expect(chunks.map((c) => c.value).join("")).toBe(value);
  });

  test("should produce more chunks when attribute-heavy options shrink per-chunk budget", () => {
    const value = "x".repeat(10_000);

    const lean = chunkCookieValue({
      name: "session",
      value,
      options: {},
      chunkSize: 4000,
    });

    const heavy = chunkCookieValue({
      name: "session",
      value,
      options: {
        domain: "very-long-subdomain.application.lindorm.example.com",
        path: "/very/deep/api/v1/sessions",
        sameSite: "strict",
        priority: "high",
        secure: true,
        httpOnly: true,
        partitioned: true,
      },
      chunkSize: 4000,
    });

    expect(heavy.length).toBeGreaterThanOrEqual(lean.length);
  });

  test("should throw when chunkSize is too small to fit overhead plus a single byte", () => {
    expect(() =>
      chunkCookieValue({
        name: "session",
        value: "x".repeat(1000),
        options: baseOptions,
        chunkSize: 10,
      }),
    ).toThrow("Cookie chunk size too small");
  });

  test("should split equally when value length is a multiple of budget", () => {
    const chunks = chunkCookieValue({
      name: "s",
      value: "a".repeat(8000),
      options: {},
      chunkSize: 4000,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.map((c) => c.value).join("")).toBe("a".repeat(8000));
  });
});
