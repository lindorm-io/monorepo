import MockDate from "mockdate";
import { AuthorizationSession } from "../../entity";
import { createTestAuthorizationSession } from "../../fixtures/entity";
import { isSelectAccountRequired } from "./is-select-account-required";
import { randomUUID } from "crypto";
import { OpenIdPromptMode, SessionStatus } from "@lindorm-io/common-types";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("isSelectAccountRequired", () => {
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      promptModes: [],
    });
  });

  test("should not require", () => {
    expect(isSelectAccountRequired(authorizationSession)).toBe(false);
  });

  test("should not require on confirmed", () => {
    authorizationSession.status.selectAccount = SessionStatus.CONFIRMED;

    expect(isSelectAccountRequired(authorizationSession)).toBe(false);
  });

  test("should not require on verified", () => {
    authorizationSession.status.selectAccount = SessionStatus.VERIFIED;

    expect(isSelectAccountRequired(authorizationSession)).toBe(false);
  });

  test("should require on prompt", () => {
    authorizationSession.promptModes.push(OpenIdPromptMode.SELECT_ACCOUNT);

    expect(isSelectAccountRequired(authorizationSession)).toBe(true);
  });

  test("should require on multiple browser sessions", () => {
    authorizationSession.requestedSelectAccount.browserSessions.push({
      browserSessionId: randomUUID(),
      identityId: randomUUID(),
    });

    expect(isSelectAccountRequired(authorizationSession)).toBe(true);
  });
});
