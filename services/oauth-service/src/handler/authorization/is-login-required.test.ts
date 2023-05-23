import { SessionStatus } from "@lindorm-io/common-types";
import { createMockLogger } from "@lindorm-io/winston";
import { AuthorizationRequest, BrowserSession, ClientSession } from "../../entity";
import {
  createTestAuthorizationRequest,
  createTestBrowserSession,
  createTestClientSession,
} from "../../fixtures/entity";
import { verifyPromptMode as _verifyPromptMode } from "../../util";
import { isLoginRequired } from "./is-login-required";
import { verifyLoginPrerequisites as _verifyLoginPrerequisites } from "./verify-login-prerequisites";

jest.mock("../../util");
jest.mock("./verify-login-prerequisites");

const verifyPromptMode = _verifyPromptMode as jest.Mock;
const verifyLoginPrerequisites = _verifyLoginPrerequisites as jest.Mock;

describe("isLoginRequired", () => {
  let ctx: any;
  let authorizationRequest: AuthorizationRequest;
  let browserSession: BrowserSession;
  let clientSession: ClientSession;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };

    authorizationRequest = createTestAuthorizationRequest();
    browserSession = createTestBrowserSession();
    clientSession = createTestClientSession();

    verifyPromptMode.mockReturnValue(true);
    verifyLoginPrerequisites.mockReturnValue(true);
  });

  test("should return false", () => {
    expect(isLoginRequired(ctx, authorizationRequest, browserSession, clientSession)).toBe(false);
  });

  test("should return false when session status is confirmed", () => {
    authorizationRequest.status.login = SessionStatus.CONFIRMED;

    expect(isLoginRequired(ctx, authorizationRequest, browserSession, clientSession)).toBe(false);
  });

  test("should return false when session status is verified", () => {
    authorizationRequest.status.login = SessionStatus.VERIFIED;

    expect(isLoginRequired(ctx, authorizationRequest, browserSession, clientSession)).toBe(false);
  });

  test("should return true when prompt mode returns false", () => {
    verifyPromptMode.mockReturnValue(false);

    expect(isLoginRequired(ctx, authorizationRequest, browserSession, clientSession)).toBe(true);
  });

  test("should return true when login prerequisites returns false", () => {
    verifyLoginPrerequisites.mockReturnValue(false);

    expect(isLoginRequired(ctx, authorizationRequest, browserSession, clientSession)).toBe(true);
  });
});
