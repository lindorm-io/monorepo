import { getHandshakeHeader } from "./get-handshake-header.js";
import { describe, expect, test } from "vitest";

describe("getHandshakeHeader", () => {
  test("should read a string header value", () => {
    const get = getHandshakeHeader({ "user-agent": "Mozilla/5.0" });

    expect(get("user-agent")).toBe("Mozilla/5.0");
  });

  test("should return the first value when the header is an array", () => {
    const get = getHandshakeHeader({ "x-forwarded-for": ["1.1.1.1", "2.2.2.2"] });

    expect(get("x-forwarded-for")).toBe("1.1.1.1");
  });

  test("should return undefined for a missing header", () => {
    const get = getHandshakeHeader({});

    expect(get("user-agent")).toBeUndefined();
  });

  test("should return undefined when headers are undefined", () => {
    const get = getHandshakeHeader(undefined);

    expect(get("user-agent")).toBeUndefined();
  });
});
