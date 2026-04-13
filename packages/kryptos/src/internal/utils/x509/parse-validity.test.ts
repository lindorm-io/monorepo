import { encodeX509Validity } from "./encode-validity";
import { parseX509Validity } from "./parse-validity";

describe("parseX509Validity", () => {
  test("round-trips UTCTime window", () => {
    const notBefore = new Date("2026-04-13T12:00:00.000Z");
    const notAfter = new Date("2027-04-13T12:00:00.000Z");
    const der = encodeX509Validity(notBefore, notAfter);

    const parsed = parseX509Validity(der);
    expect(parsed.notBefore.toISOString()).toBe(notBefore.toISOString());
    expect(parsed.notAfter.toISOString()).toBe(notAfter.toISOString());
  });

  test("round-trips GeneralizedTime window (year >= 2050)", () => {
    const notBefore = new Date("2051-01-01T00:00:00.000Z");
    const notAfter = new Date("2099-12-31T23:59:59.000Z");
    const der = encodeX509Validity(notBefore, notAfter);

    const parsed = parseX509Validity(der);
    expect(parsed.notBefore.toISOString()).toBe(notBefore.toISOString());
    expect(parsed.notAfter.toISOString()).toBe(notAfter.toISOString());
  });
});
