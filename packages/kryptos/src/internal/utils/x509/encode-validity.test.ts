import { encodeX509Validity } from "./encode-validity";
import { describe, expect, test } from "vitest";

describe("encodeX509Validity", () => {
  test("encodes a UTCTime range", () => {
    const notBefore = new Date("2024-01-01T00:00:00.000Z");
    const notAfter = new Date("2025-01-01T00:00:00.000Z");
    expect(encodeX509Validity(notBefore, notAfter).toString("hex")).toMatchSnapshot();
  });

  test("encodes a GeneralizedTime range for post-2049 dates", () => {
    const notBefore = new Date("2024-01-01T00:00:00.000Z");
    const notAfter = new Date("2050-01-01T00:00:00.000Z");
    expect(encodeX509Validity(notBefore, notAfter).toString("hex")).toMatchSnapshot();
  });
});
