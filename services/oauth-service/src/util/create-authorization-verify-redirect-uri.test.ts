import { createAuthorizationVerifyRedirectUri } from "./create-authorization-verify-redirect-uri";
import { createTestAuthorizationSession } from "../fixtures/entity";

describe("createAuthorizationVerifyRedirectUri", () => {
  test("should resolve string", () => {
    expect(
      createAuthorizationVerifyRedirectUri(
        createTestAuthorizationSession({ id: "df6326a9-6af1-4b0b-b9b7-8395393b2c92" }),
      ),
    ).toBe(
      "https://oauth.test.lindorm.io/oauth2/sessions/authorize/verify?session_id=df6326a9-6af1-4b0b-b9b7-8395393b2c92&redirect_uri=https%3A%2F%2Ftest.client.lindorm.io%2Fredirect",
    );
  });
});
