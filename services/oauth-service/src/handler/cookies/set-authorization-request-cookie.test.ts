import { createMockLogger } from "@lindorm-io/core-logger";
import MockDate from "mockdate";
import { AUTHORIZATION_SESSION_COOKIE_NAME } from "../../constant";
import { AuthorizationRequest } from "../../entity";
import { createTestAuthorizationRequest } from "../../fixtures/entity";
import { setAuthorizationRequestCookie } from "./set-authorization-request-cookie";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("setAuthorizationRequestCookie", () => {
  let ctx: any;
  let authorizationRequest: AuthorizationRequest;

  beforeEach(() => {
    ctx = {
      cookies: {
        set: jest.fn(),
      },
      logger: createMockLogger(),
      server: {
        environment: "test",
      },
    };

    authorizationRequest = createTestAuthorizationRequest({
      id: "09b5c6b5-51f7-45e6-b0de-3cd36d2652f8",
    });
  });

  test("should set cookie", () => {
    expect(() => setAuthorizationRequestCookie(ctx, authorizationRequest)).not.toThrow();

    expect(ctx.cookies.set).toHaveBeenCalledWith(
      AUTHORIZATION_SESSION_COOKIE_NAME,
      "09b5c6b5-51f7-45e6-b0de-3cd36d2652f8",
      {
        expires: new Date("2021-01-02T08:00:00.000Z"),
        httpOnly: true,
        overwrite: true,
        signed: false,
      },
    );
  });
});
