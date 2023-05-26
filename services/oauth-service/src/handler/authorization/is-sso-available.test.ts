import { createMockLogger } from "@lindorm-io/winston";
import { AuthorizationSession, BrowserSession, Client } from "../../entity";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
} from "../../fixtures/entity";
import {
  verifyAccessLevel as _verifyAccessLevel,
  verifyIdentityId as _verifyIdentityId,
  verifyMaxAge as _verifyMaxAge,
  verifyPromptMode as _verifyPromptMode,
  verifyRequiredMethods as _verifyRequiredMethods,
  verifySessionExpiry as _verifySessionExpiry,
} from "../../util";
import { isSsoAvailable } from "./is-sso-available";

jest.mock("../../util");

const verifyAccessLevel = _verifyAccessLevel as jest.Mock;
const verifyIdentityId = _verifyIdentityId as jest.Mock;
const verifyMaxAge = _verifyMaxAge as jest.Mock;
const verifyPromptMode = _verifyPromptMode as jest.Mock;
const verifyRequiredMethods = _verifyRequiredMethods as jest.Mock;
const verifySessionExpiry = _verifySessionExpiry as jest.Mock;

describe("isSsoAvailable", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };

    authorizationSession = createTestAuthorizationSession();
    client = createTestClient();
    browserSession = createTestBrowserSession();

    verifyAccessLevel.mockReturnValue(true);
    verifyIdentityId.mockReturnValue(true);
    verifyMaxAge.mockReturnValue(true);
    verifyPromptMode.mockReturnValue(true);
    verifyRequiredMethods.mockReturnValue(true);
    verifySessionExpiry.mockReturnValue(true);
  });

  test("should return true", () => {
    expect(isSsoAvailable(ctx, authorizationSession, client, browserSession)).toBe(true);
  });

  test("should return false when browser session is missing", () => {
    expect(isSsoAvailable(ctx, authorizationSession, client)).toBe(false);
  });

  test("should return false when browser session sso is false", () => {
    browserSession.singleSignOn = false;

    expect(isSsoAvailable(ctx, authorizationSession, client, browserSession)).toBe(false);
  });

  test("should return false when client sso is false", () => {
    client.singleSignOn = false;

    expect(isSsoAvailable(ctx, authorizationSession, client, browserSession)).toBe(false);
  });

  test("should return false on prompt mode returning false", () => {
    verifyPromptMode.mockReturnValue(false);

    expect(isSsoAvailable(ctx, authorizationSession, client, browserSession)).toBe(false);
  });

  test("should return false on identity id returning false", () => {
    verifyIdentityId.mockReturnValue(false);

    expect(isSsoAvailable(ctx, authorizationSession, client, browserSession)).toBe(false);
  });

  test("should return false on access level returning false", () => {
    verifyAccessLevel.mockReturnValue(false);

    expect(isSsoAvailable(ctx, authorizationSession, client, browserSession)).toBe(false);
  });

  test("should return false on required methods returning false", () => {
    verifyRequiredMethods.mockReturnValue(false);

    expect(isSsoAvailable(ctx, authorizationSession, client, browserSession)).toBe(false);
  });

  test("should return false on session expiry returning false", () => {
    verifySessionExpiry.mockReturnValue(false);

    expect(isSsoAvailable(ctx, authorizationSession, client, browserSession)).toBe(false);
  });

  test("should return false on max age returning false", () => {
    verifyMaxAge.mockReturnValue(false);

    expect(isSsoAvailable(ctx, authorizationSession, client, browserSession)).toBe(false);
  });
});
