import { describe, expect, test } from "vitest";
import { NamingSystem } from "./NamingSystem.js";

describe("NamingSystem", () => {
  test("should match snapshot", () => {
    expect(NamingSystem).toMatchSnapshot();
  });

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: NamingSystem = NamingSystem.GivenFamily;
    const fromLiteral: NamingSystem = "family_given";

    expect([fromEnum, fromLiteral]).toMatchSnapshot();
  });
});
