import { AuthorizationSession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { PromptMode } from "../../common";
import { assertAuthorizePrompt } from "./assert-authorize-prompt";
import { createTestAuthorizationSession } from "../../fixtures/entity";

describe("assertAuthorizePrompt", () => {
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      promptModes: [PromptMode.LOGIN, PromptMode.CONSENT],
    });
  });

  test("should succeed without verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        isConsentRequired: false,
        isAuthenticationRequired: false,
      }),
    ).not.toThrow();
  });

  test("should succeed with login verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        isConsentRequired: false,
        isAuthenticationRequired: true,
      }),
    ).not.toThrow();
  });

  test("should succeed with consent verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        isConsentRequired: true,
        isAuthenticationRequired: false,
      }),
    ).not.toThrow();
  });

  test("should throw when login is required", () => {
    authorizationSession = createTestAuthorizationSession({
      promptModes: [PromptMode.NONE],
    });

    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        isConsentRequired: false,
        isAuthenticationRequired: true,
      }),
    ).toThrow(ClientError);
  });

  test("should throw when consent is required", () => {
    authorizationSession = createTestAuthorizationSession({
      promptModes: [PromptMode.NONE],
    });

    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        isConsentRequired: true,
        isAuthenticationRequired: false,
      }),
    ).toThrow(ClientError);
  });
});
