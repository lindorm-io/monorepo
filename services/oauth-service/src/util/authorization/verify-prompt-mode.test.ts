import { OpenIdPromptMode } from "@lindorm-io/common-types";
import { createTestAuthorizationSession } from "../../fixtures/entity";
import { verifyPromptMode } from "./verify-prompt-mode";

describe("verifyPromptMode", () => {
  test("should return true when prompt mode is not included", () => {
    expect(
      verifyPromptMode(
        createTestAuthorizationSession({
          promptModes: [],
        }),
        OpenIdPromptMode.LOGIN,
      ),
    ).toBe(true);
  });

  test("should return true when prompt mode is not included", () => {
    expect(
      verifyPromptMode(
        createTestAuthorizationSession({
          promptModes: [],
        }),
        OpenIdPromptMode.CONSENT,
      ),
    ).toBe(true);
  });

  test("should return false when prompt mode is included", () => {
    expect(
      verifyPromptMode(
        createTestAuthorizationSession({
          promptModes: [OpenIdPromptMode.LOGIN],
        }),
        OpenIdPromptMode.LOGIN,
      ),
    ).toBe(false);
  });
});
