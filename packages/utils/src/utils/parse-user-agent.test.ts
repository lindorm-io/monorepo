import { parseUserAgent } from "./parse-user-agent.js";
import { describe, expect, test } from "vitest";

describe("parseUserAgent", () => {
  test("should parse Chrome on Windows", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36",
      ),
    ).toMatchSnapshot();
  });

  test("should parse Chrome on Android as mobile", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
      ),
    ).toMatchSnapshot();
  });

  test("should parse Chrome on Android tablet without Mobile token", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Linux; Android 12; SM-X906C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      ),
    ).toMatchSnapshot();
  });

  test("should parse Safari on iPhone as mobile iOS", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
      ),
    ).toMatchSnapshot();
  });

  test("should parse Safari on iPad as tablet iOS", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/604.1",
      ),
    ).toMatchSnapshot();
  });

  test("should parse Safari on macOS", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      ),
    ).toMatchSnapshot();
  });

  test("should parse Firefox on Linux", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
      ),
    ).toMatchSnapshot();
  });

  test("should parse Edge on Windows", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.61",
      ),
    ).toMatchSnapshot();
  });

  test("should parse Opera on Windows", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0",
      ),
    ).toMatchSnapshot();
  });

  test("should parse Samsung Internet on Android", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
      ),
    ).toMatchSnapshot();
  });

  test("should parse an Electron app UA", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) MyApp/1.2.3 Chrome/114.0.5735.289 Electron/25.8.4 Safari/537.36",
      ),
    ).toMatchSnapshot();
  });

  test("should parse a googlebot UA as bot", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ),
    ).toMatchSnapshot();
  });

  test("should degrade gracefully for an empty string", () => {
    expect(parseUserAgent("")).toMatchSnapshot();
  });

  test("should degrade gracefully for null", () => {
    expect(parseUserAgent(null)).toMatchSnapshot();
  });

  test("should degrade gracefully for garbage input", () => {
    expect(parseUserAgent("!!! not a user agent !!!")).toMatchSnapshot();
  });
});
