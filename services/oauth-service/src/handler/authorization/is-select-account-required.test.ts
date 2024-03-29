import { SessionStatus } from "@lindorm-io/common-enums";
import { createMockLogger } from "@lindorm-io/winston";
import { AuthorizationSession } from "../../entity";
import { createTestAuthorizationSession } from "../../fixtures/entity";
import {
  verifyBrowserSessions as _verifyBrowserSessions,
  verifyPromptMode as _verifyPromptMode,
} from "../../util";
import { isSelectAccountRequired } from "./is-select-account-required";

jest.mock("../../util");

const verifyBrowserSessions = _verifyBrowserSessions as jest.Mock;
const verifyPromptMode = _verifyPromptMode as jest.Mock;

describe("isSelectAccountRequired", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };

    authorizationSession = createTestAuthorizationSession();

    verifyBrowserSessions.mockReturnValue(true);
    verifyPromptMode.mockReturnValue(true);
  });

  test("should return false", () => {
    expect(isSelectAccountRequired(ctx, authorizationSession)).toBe(false);
  });

  test("should return false when session status is confirmed", () => {
    authorizationSession.status.consent = SessionStatus.CONFIRMED;

    expect(isSelectAccountRequired(ctx, authorizationSession)).toBe(false);
  });

  test("should return false when session status is verified", () => {
    authorizationSession.status.consent = SessionStatus.VERIFIED;

    expect(isSelectAccountRequired(ctx, authorizationSession)).toBe(false);
  });

  test("should return true when prompt mode returns false", () => {
    verifyPromptMode.mockReturnValue(false);

    expect(isSelectAccountRequired(ctx, authorizationSession)).toBe(true);
  });

  test("should return true when browser sessions returns false", () => {
    verifyBrowserSessions.mockReturnValue(false);

    expect(isSelectAccountRequired(ctx, authorizationSession)).toBe(true);
  });
});
