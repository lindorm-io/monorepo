import { axiosBasicAuthMiddleware } from "./axios-basic-auth-middleware";

describe("axiosBasicAuthMiddleware", () => {
  let middleware: any;

  beforeEach(() => {
    middleware = axiosBasicAuthMiddleware({ username: "username", password: "password" });
  });

  test("should add basic auth to config object", async () => {
    await expect(
      middleware.config({
        method: "GET",
        url: "http://url.com",
      }),
    ).resolves.toStrictEqual({
      auth: {
        password: "password",
        username: "username",
      },
      method: "GET",
      url: "http://url.com",
    });
  });
});
