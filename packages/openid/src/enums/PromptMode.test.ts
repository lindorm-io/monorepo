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

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: PromptMode = PromptMode.SelectAccount;
    const fromLiteral: PromptMode = "none";
    // @ts-expect-error the type is CLOSED — an unregistered prompt value is not a PromptMode
    const rejected: PromptMode = "urn:example:prompt";
    // a deployment accepting an unregistered value widens in ITS OWN package, never here
    const widened: PromptMode | "urn:example:prompt" = "urn:example:prompt";

    expect([fromEnum, fromLiteral, rejected, widened]).toMatchSnapshot();
  });
});
