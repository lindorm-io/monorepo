import { axiosBearerAuthMiddleware } from "./axios-bearer-auth-middleware";

describe("axiosBearerAuthMiddleware", () => {
  let middleware: any;

  beforeEach(() => {
    middleware = axiosBearerAuthMiddleware("jwt.jwt.jwt");
  });

  test("should add bearer auth to request headers", async () => {
    await expect(
      middleware.request({
        data: { data: true },
        headers: { headers: true },
        params: { params: true },
      }),
    ).resolves.toStrictEqual({
      data: {
        data: true,
      },
      headers: {
        Authorization: "Bearer jwt.jwt.jwt",
        headers: true,
      },
      params: {
        params: true,
      },
    });
  });
});
