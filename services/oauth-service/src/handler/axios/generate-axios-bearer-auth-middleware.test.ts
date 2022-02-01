import { generateAxiosBearerAuthMiddleware } from "./generate-axios-bearer-auth-middleware";

describe("generateAxiosBearerAuthMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: { sign: jest.fn().mockImplementation(() => ({ token: "jwt.jwt.jwt" })) },
    };
  });

  test("should resolve middleware", () => {
    expect(generateAxiosBearerAuthMiddleware(ctx, ["permissions"], ["scope"])).toStrictEqual(
      expect.objectContaining({
        request: expect.any(Function),
      }),
    );
  });
});
