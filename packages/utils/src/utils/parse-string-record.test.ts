import { parseStringRecord } from "./parse-string-record.js";
import { describe, expect, test } from "vitest";

describe("parseStringRecord", () => {
  test("should parse strings inside record to correct types", () => {
    expect(
      parseStringRecord({
        a: "1",
        b: "true",
        c: "false",
        d: "null",
        e: "undefined",
        f: '["a", "b"]',
        g: '{"a": 1}',
        h: "hello",
      }),
    ).toEqual({
      a: 1,
      b: true,
      c: false,
      d: null,
      e: undefined,
      f: ["a", "b"],
      g: { a: 1 },
      h: "hello",
    });
  });

  test("should parse an ISO date string with an offset into a Date", () => {
    expect(
      parseStringRecord({
        a: "2026-08-10T12:00:00Z",
        b: "2026-08-10T12:00:00.123+02:00",
      }),
    ).toEqual({
      a: new Date("2026-08-10T12:00:00Z"),
      b: new Date("2026-08-10T12:00:00.123+02:00"),
    });
  });

  test("should leave a shaped but impossible date as a string rather than an Invalid Date", () => {
    expect(
      parseStringRecord({
        a: "2026-13-45T99:99:99Z",
        b: "2026-02-30T00:00:00Z",
        c: "2026-08-10T12:00:00+99:00",
      }),
    ).toEqual({
      a: "2026-13-45T99:99:99Z",
      b: "2026-02-30T00:00:00Z",
      c: "2026-08-10T12:00:00+99:00",
    });
  });

  test("should leave a partial date as a string, since converting it would guess an instant", () => {
    expect(
      parseStringRecord({
        a: "2026-08-10",
        b: "2026-08-10T12:00:00",
        c: "2026-08-10T12:00:00+0200",
      }),
    ).toEqual({
      a: "2026-08-10",
      b: "2026-08-10T12:00:00",
      c: "2026-08-10T12:00:00+0200",
    });
  });
});
