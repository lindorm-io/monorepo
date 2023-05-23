import { AuthorizationRequest, ClientSession } from "../../entity";
import { createTestAuthorizationRequest, createTestClientSession } from "../../fixtures/entity";
import { verifyRequiredAudiences } from "./verify-required-audiences";

describe("verifyRequiredAudiences", () => {
  let authorizationRequest: AuthorizationRequest;
  let clientSession: ClientSession;

  beforeEach(() => {
    authorizationRequest = createTestAuthorizationRequest();

    clientSession = createTestClientSession();
  });

  test("should return true when authorization session has no required audiences", () => {
    authorizationRequest.requestedConsent.audiences = [];

    expect(verifyRequiredAudiences(authorizationRequest, clientSession)).toBe(true);
  });

  test("should return true when audiences match", () => {
    authorizationRequest.requestedConsent.audiences = ["aud"];
    clientSession.audiences = ["aud"];

    expect(verifyRequiredAudiences(authorizationRequest, clientSession)).toBe(true);
  });

  test("should return true with many audiences", () => {
    authorizationRequest.requestedConsent.audiences = ["aud"];
    clientSession.audiences = ["aud", "aud2", "aud3"];

    expect(verifyRequiredAudiences(authorizationRequest, clientSession)).toBe(true);
  });

  test("should return false when session has no audiences", () => {
    authorizationRequest.requestedConsent.audiences = ["aud"];
    clientSession.audiences = [];

    expect(verifyRequiredAudiences(authorizationRequest, clientSession)).toBe(false);
  });

  test("should return false when session has missing audiences", () => {
    authorizationRequest.requestedConsent.audiences = ["aud3"];
    clientSession.audiences = ["aud"];

    expect(verifyRequiredAudiences(authorizationRequest, clientSession)).toBe(false);
  });
});
