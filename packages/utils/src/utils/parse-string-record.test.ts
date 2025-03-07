import { parseStringRecord } from "./parse-string-record";

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
});
