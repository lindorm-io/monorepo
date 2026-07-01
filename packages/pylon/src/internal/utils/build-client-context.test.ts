import { CLIENT_HEADERS } from "@lindorm/types";
import { buildClientContext } from "./build-client-context.js";
import { describe, expect, test } from "vitest";

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

const getHeaderFrom =
  (headers: Record<string, string>) =>
  (name: string): string | undefined =>
    headers[name];

describe("buildClientContext", () => {
  test("should build from full declared header set", () => {
    const result = buildClientContext(
      CHROME_UA,
      getHeaderFrom({
        [CLIENT_HEADERS.app]: "MyApp",
        [CLIENT_HEADERS.appVersion]: "2.3.4",
        [CLIENT_HEADERS.build]: "1042",
        [CLIENT_HEADERS.channel]: "beta",
        [CLIENT_HEADERS.deviceName]: "Jonn's Phone",
        [CLIENT_HEADERS.deviceModel]: "iPhone15,2",
        [CLIENT_HEADERS.deviceType]: "mobile",
        [CLIENT_HEADERS.platform]: "ios",
        [CLIENT_HEADERS.timezone]: "Europe/Oslo",
      }),
    );

    expect(result).toMatchSnapshot();
  });

  test("should build pure user-agent context when no declared headers present", () => {
    const result = buildClientContext(CHROME_UA, () => undefined);

    expect(result).toMatchSnapshot();
  });

  test("should override user-agent deviceType with declared deviceType", () => {
    const result = buildClientContext(
      CHROME_UA,
      getHeaderFrom({ [CLIENT_HEADERS.deviceType]: "tv" }),
    );

    expect(result.userAgent.deviceType).toBe("tv");
    expect(result).toMatchSnapshot();
  });

  test("should surface app with 'unknown' name when only appVersion declared", () => {
    const result = buildClientContext(
      null,
      getHeaderFrom({ [CLIENT_HEADERS.appVersion]: "9.9.9" }),
    );

    expect(result.app).toEqual({ name: "unknown", version: "9.9.9" });
    expect(result).toMatchSnapshot();
  });

  test("should build device with null name when only deviceModel declared", () => {
    const result = buildClientContext(
      null,
      getHeaderFrom({ [CLIENT_HEADERS.deviceModel]: "SM-G991B" }),
    );

    expect(result.device).toEqual({ name: null, model: "SM-G991B" });
    expect(result).toMatchSnapshot();
  });
});
