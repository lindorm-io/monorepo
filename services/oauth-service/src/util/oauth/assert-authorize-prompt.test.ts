import { OpenIdPromptMode } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { AuthorizationRequest } from "../../entity";
import { createTestAuthorizationRequest } from "../../fixtures/entity";
import { assertAuthorizePrompt } from "./assert-authorize-prompt";

describe("assertAuthorizePrompt", () => {
  let authorizationRequest: AuthorizationRequest;

  beforeEach(() => {
    authorizationRequest = createTestAuthorizationRequest({
      promptModes: [OpenIdPromptMode.LOGIN, OpenIdPromptMode.CONSENT],
    });
  });

  test("should succeed without verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationRequest, {
        consentRequired: false,
        loginRequired: false,
        selectAccountRequired: false,
      }),
    ).not.toThrow();
  });

  test("should succeed with login verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationRequest, {
        consentRequired: false,
        loginRequired: true,
        selectAccountRequired: false,
      }),
    ).not.toThrow();
  });

  test("should succeed with consent verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationRequest, {
        consentRequired: true,
        loginRequired: false,
        selectAccountRequired: false,
      }),
    ).not.toThrow();
  });

  test("should succeed with consent verification", () => {
    expect(() =>
      assertAuthorizePrompt(authorizationRequest, {
        consentRequired: false,
        loginRequired: false,
        selectAccountRequired: true,
      }),
    ).not.toThrow();
  });

  test("should throw when login is required", () => {
    authorizationRequest = createTestAuthorizationRequest({
      promptModes: [OpenIdPromptMode.NONE],
    });

    expect(() =>
      assertAuthorizePrompt(authorizationRequest, {
        consentRequired: false,
        loginRequired: true,
        selectAccountRequired: false,
      }),
    ).toThrow(ClientError);
  });

  test("should throw when consent is required", () => {
    authorizationRequest = createTestAuthorizationRequest({
      promptModes: [OpenIdPromptMode.NONE],
    });

    expect(() =>
      assertAuthorizePrompt(authorizationRequest, {
        consentRequired: true,
        loginRequired: false,
        selectAccountRequired: false,
      }),
    ).toThrow(ClientError);
  });

  test("should throw when select is required", () => {
    authorizationRequest = createTestAuthorizationRequest({
      promptModes: [OpenIdPromptMode.NONE],
    });

    expect(() =>
      assertAuthorizePrompt(authorizationRequest, {
        consentRequired: false,
        loginRequired: false,
        selectAccountRequired: true,
      }),
    ).toThrow(ClientError);
  });
});
