import { createLogoutVerifyUri } from "./create-logout-verify-uri";
import { createTestLogoutSession } from "../../fixtures/entity";

describe("createLogoutVerifyRedirectUri", () => {
  test("should resolve string", () => {
    expect(
      createLogoutVerifyUri(
        createTestLogoutSession({ id: "df6326a9-6af1-4b0b-b9b7-8395393b2c92" }),
      ),
    ).toBe(
      "https://oauth.test.lindorm.io/oauth2/sessions/logout/verify?session=df6326a9-6af1-4b0b-b9b7-8395393b2c92&post_logout_redirect_uri=https%3A%2F%2Ftest.client.lindorm.io%2Flogout",
    );
  });
});
