import { AuthorizationSession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertAuthorizePrompt } from "./assert-authorize-prompt";
import { createTestAuthorizationSession } from "../../fixtures/entity";
import { OpenIdPromptMode } from "@lindorm-io/common-types";

describe("assertAuthorizePrompt", () => {
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      promptModes: [OpenIdPromptMode.LOGIN, OpenIdPromptMode.CONSENT],
    });
  });

  test("should succeed without verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        consentRequired: false,
        loginRequired: false,
        selectAccountRequired: false,
      }),
    ).not.toThrow();
  });

  test("should succeed with login verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        consentRequired: false,
        loginRequired: true,
        selectAccountRequired: false,
      }),
    ).not.toThrow();
  });

  test("should succeed with consent verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        consentRequired: true,
        loginRequired: false,
        selectAccountRequired: false,
      }),
    ).not.toThrow();
  });

  test("should succeed with consent verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        consentRequired: false,
        loginRequired: false,
        selectAccountRequired: true,
      }),
    ).not.toThrow();
  });

  test("should throw when login is required", () => {
    authorizationSession = createTestAuthorizationSession({
      promptModes: [OpenIdPromptMode.NONE],
    });

    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        consentRequired: false,
        loginRequired: true,
        selectAccountRequired: false,
      }),
    ).toThrow(ClientError);
  });

  test("should throw when consent is required", () => {
    authorizationSession = createTestAuthorizationSession({
      promptModes: [OpenIdPromptMode.NONE],
    });

    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        consentRequired: true,
        loginRequired: false,
        selectAccountRequired: false,
      }),
    ).toThrow(ClientError);
  });

  test("should throw when select is required", () => {
    authorizationSession = createTestAuthorizationSession({
      promptModes: [OpenIdPromptMode.NONE],
    });

    expect(() =>
      assertAuthorizePrompt(authorizationSession, {
        consentRequired: false,
        loginRequired: false,
        selectAccountRequired: true,
      }),
    ).toThrow(ClientError);
  });
});
