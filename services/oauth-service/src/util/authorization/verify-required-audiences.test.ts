import { AuthorizationSession, ClientSession } from "../../entity";
import { createTestAuthorizationSession, createTestClientSession } from "../../fixtures/entity";
import { verifyRequiredAudiences } from "./verify-required-audiences";

describe("verifyRequiredAudiences", () => {
  let authorizationSession: AuthorizationSession;
  let clientSession: ClientSession;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession();

    clientSession = createTestClientSession();
  });

  test("should return true when authorization session has no required audiences", () => {
    authorizationSession.requestedConsent.audiences = [];

    expect(verifyRequiredAudiences(authorizationSession, clientSession)).toBe(true);
  });

  test("should return true when audiences match", () => {
    authorizationSession.requestedConsent.audiences = ["aud"];
    clientSession.audiences = ["aud"];

    expect(verifyRequiredAudiences(authorizationSession, clientSession)).toBe(true);
  });

  test("should return true with many audiences", () => {
    authorizationSession.requestedConsent.audiences = ["aud"];
    clientSession.audiences = ["aud", "aud2", "aud3"];

    expect(verifyRequiredAudiences(authorizationSession, clientSession)).toBe(true);
  });

  test("should return false when session has no audiences", () => {
    authorizationSession.requestedConsent.audiences = ["aud"];
    clientSession.audiences = [];

    expect(verifyRequiredAudiences(authorizationSession, clientSession)).toBe(false);
  });

  test("should return false when session has missing audiences", () => {
    authorizationSession.requestedConsent.audiences = ["aud3"];
    clientSession.audiences = ["aud"];

    expect(verifyRequiredAudiences(authorizationSession, clientSession)).toBe(false);
  });
});
