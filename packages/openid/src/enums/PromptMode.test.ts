import { describe, expect, test } from "vitest";
import { PromptMode } from "./PromptMode.js";

describe("PromptMode", () => {
  test("should match snapshot", () => {
    expect(PromptMode).toMatchSnapshot();
  });

  test("should carry the OIDC Core values plus the registration create value", () => {
    expect(Object.values(PromptMode)).toEqual([
      "consent",
      "create",
      "login",
      "select_account",
      "none",
    ]);
  });

  test("should derive the type from the runtime values", () => {
    const fromEnum: PromptMode = PromptMode.SelectAccount;
    const fromLiteral: PromptMode = "none";
    const extension: PromptMode = "urn:example:prompt";

    expect([fromEnum, fromLiteral, extension]).toMatchSnapshot();
  });
});
