import { CLIENT_HEADERS } from "@lindorm/types";
import { parseClientHeaders, toClientHeaders } from "./client-headers.js";
import { describe, expect, test } from "vitest";

const getter =
  (headers: Record<string, string | undefined>) =>
  (headerName: string): string | undefined =>
    headers[headerName];

describe("parseClientHeaders", () => {
  test("should parse a full header set", () => {
    expect(
      parseClientHeaders(
        getter({
          [CLIENT_HEADERS.app]: "Acme",
          [CLIENT_HEADERS.appVersion]: "1.2.3",
          [CLIENT_HEADERS.build]: "4567",
          [CLIENT_HEADERS.channel]: "beta",
          [CLIENT_HEADERS.deviceName]: "Jonn's iPhone",
          [CLIENT_HEADERS.deviceModel]: "iPhone15,2",
          [CLIENT_HEADERS.deviceType]: "mobile",
          [CLIENT_HEADERS.platform]: "ios",
          [CLIENT_HEADERS.timezone]: "Europe/Oslo",
        }),
      ),
    ).toMatchSnapshot();
  });

  test("should parse a partial header set with nulls for absent headers", () => {
    expect(
      parseClientHeaders(
        getter({
          [CLIENT_HEADERS.app]: "Acme",
          [CLIENT_HEADERS.platform]: "web",
        }),
      ),
    ).toMatchSnapshot();
  });

  test("should trim and cap values at 256 chars", () => {
    const result = parseClientHeaders(
      getter({
        [CLIENT_HEADERS.deviceName]: `  ${"x".repeat(300)}  `,
      }),
    );

    expect(result.deviceName).toHaveLength(256);
    expect(result).toMatchSnapshot();
  });

  test("should reject an invalid deviceType token", () => {
    expect(
      parseClientHeaders(
        getter({
          [CLIENT_HEADERS.deviceType]: "toaster",
        }),
      ).deviceType,
    ).toBeNull();
  });

  test("should accept all valid deviceType tokens", () => {
    for (const value of [
      "desktop",
      "mobile",
      "tablet",
      "bot",
      "tv",
      "console",
      "unknown",
    ]) {
      expect(
        parseClientHeaders(getter({ [CLIENT_HEADERS.deviceType]: value })).deviceType,
      ).toBe(value);
    }
  });

  test("should treat empty strings as null", () => {
    expect(
      parseClientHeaders(
        getter({
          [CLIENT_HEADERS.app]: "",
          [CLIENT_HEADERS.channel]: "   ",
        }),
      ),
    ).toMatchSnapshot();
  });
});

describe("toClientHeaders", () => {
  test("should emit headers for non-null fields only", () => {
    expect(
      toClientHeaders({
        app: "Acme",
        appVersion: "1.2.3",
        deviceType: "mobile",
        build: null,
        channel: undefined,
        platform: "",
      }),
    ).toMatchSnapshot();
  });

  test("should cap emitted values at 256 chars", () => {
    const result = toClientHeaders({ deviceName: "x".repeat(300) });
    expect(result[CLIENT_HEADERS.deviceName]).toHaveLength(256);
  });

  test("should round-trip with parseClientHeaders", () => {
    const declared = {
      app: "Acme",
      appVersion: "1.2.3",
      build: "4567",
      channel: "beta",
      deviceName: "Jonn's iPhone",
      deviceModel: "iPhone15,2",
      deviceType: "mobile" as const,
      platform: "ios",
      timezone: "Europe/Oslo",
    };

    const headers = toClientHeaders(declared);
    const parsed = parseClientHeaders(getter(headers));

    expect(parsed).toEqual(declared);
  });
});
