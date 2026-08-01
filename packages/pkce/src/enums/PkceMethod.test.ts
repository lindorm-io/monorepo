import { describe, expect, test } from "vitest";
import { PkceMethod } from "./PkceMethod.js";

describe("PkceMethod", () => {
  test("should match snapshot", () => {
    expect(PkceMethod).toMatchSnapshot();
  });

  test("should carry the RFC 7636 section 4.2 values with exact casing", () => {
    expect(Object.values(PkceMethod)).toEqual(["plain", "S256"]);
  });

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: PkceMethod = PkceMethod.S256;
    const fromLiteral: PkceMethod = "plain";

    expect([fromEnum, fromLiteral]).toMatchSnapshot();
  });
});
