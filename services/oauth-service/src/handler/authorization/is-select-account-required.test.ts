import { SessionStatus } from "@lindorm-io/common-types";
import { createMockLogger } from "@lindorm-io/winston";
import { AuthorizationRequest } from "../../entity";
import { createTestAuthorizationRequest } from "../../fixtures/entity";
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
  let authorizationRequest: AuthorizationRequest;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };

    authorizationRequest = createTestAuthorizationRequest();

    verifyBrowserSessions.mockReturnValue(true);
    verifyPromptMode.mockReturnValue(true);
  });

  test("should return false", () => {
    expect(isSelectAccountRequired(ctx, authorizationRequest)).toBe(false);
  });

  test("should return false when session status is confirmed", () => {
    authorizationRequest.status.consent = SessionStatus.CONFIRMED;

    expect(isSelectAccountRequired(ctx, authorizationRequest)).toBe(false);
  });

  test("should return false when session status is verified", () => {
    authorizationRequest.status.consent = SessionStatus.VERIFIED;

    expect(isSelectAccountRequired(ctx, authorizationRequest)).toBe(false);
  });

  test("should return true when prompt mode returns false", () => {
    verifyPromptMode.mockReturnValue(false);

    expect(isSelectAccountRequired(ctx, authorizationRequest)).toBe(true);
  });

  test("should return true when browser sessions returns false", () => {
    verifyBrowserSessions.mockReturnValue(false);

    expect(isSelectAccountRequired(ctx, authorizationRequest)).toBe(true);
  });
});
