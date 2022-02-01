import { redirectErrorMiddleware } from "./redirect-error-middleware";
import { LindormError } from "@lindorm-io/errors";

const next = jest.fn();

describe("redirectErrorMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      request: { body: { redirectUri: "https://redirect.path.uri/" } },
    };
  });

  afterEach(jest.clearAllMocks);

  test("should resolve middleware on no error", async () => {
    next.mockResolvedValue(undefined);

    await expect(
      redirectErrorMiddleware({ redirectUri: "https://redirect.static.uri/" })(ctx, next),
    ).resolves.toBeUndefined();
  });

  test("should throw with static redirect error", async () => {
    next.mockRejectedValue(new LindormError("message"));

    await expect(
      redirectErrorMiddleware({ redirectUri: "https://redirect.static.uri/" })(ctx, next),
    ).rejects.toThrow(expect.objectContaining({ redirect: "https://redirect.static.uri/" }));
  });

  test("should throw with redirect error on path", async () => {
    next.mockRejectedValue(new LindormError("message"));

    await expect(
      redirectErrorMiddleware({
        path: "request.body.redirectUri",
        redirectUri: "https://redirect.static.uri/",
      })(ctx, next),
    ).rejects.toThrow(expect.objectContaining({ redirect: "https://redirect.path.uri/" }));
  });

  test("should throw with static redirect error when path is null", async () => {
    next.mockRejectedValue(new LindormError("message"));

    await expect(
      redirectErrorMiddleware({
        path: "request.body.nothing",
        redirectUri: "https://redirect.static.uri/",
      })(ctx, next),
    ).rejects.toThrow(expect.objectContaining({ redirect: "https://redirect.static.uri/" }));
  });

  test("should throw with static redirect error when path is not url", async () => {
    ctx.request.body.redirectUri = "wrong";

    next.mockRejectedValue(new LindormError("message"));

    await expect(
      redirectErrorMiddleware({
        path: "request.body.redirectUri",
        redirectUri: "https://redirect.static.uri/",
      })(ctx, next),
    ).rejects.toThrow(expect.objectContaining({ redirect: "https://redirect.static.uri/" }));
  });

  test("should utilise error data object as fallback", async () => {
    next.mockRejectedValue(
      new LindormError("message", {
        data: {
          code: "lindorm_code",
          description: "lindorm description",
          uri: "uri",
          state: "state",
        },
      }),
    );

    await expect(
      redirectErrorMiddleware({
        path: "request.body.redirectUri",
        redirectUri: "https://redirect.static.uri/",
      })(ctx, next),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "lindorm_code",
        description: "lindorm description",
        redirect: "https://redirect.path.uri/",
        uri: "uri",
        state: "state",
      }),
    );
  });
});
