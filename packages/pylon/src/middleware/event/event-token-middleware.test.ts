import { createMockAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger";
import { socketTokenMiddleware } from "./event-token-middleware";

describe("createSocketTokenMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      args: { id_token: "id_token" },

      aegis: createMockAegis(),
      logger: createMockLogger(),

      socket: {
        data: {
          tokens: {},
        },
        handshake: { auth: { bearer: "token" } },
      },
    };

    options = {
      contextKey: "id",
      issuer: "issuer",
    };
  });

  test("should resolve", async () => {
    await expect(
      socketTokenMiddleware(options)("args.id_token")(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.socket.data.tokens.id).toEqual({
      decoded: {},
      header: {},
      payload: {
        subject: "mocked_subject",
      },
    });
  });

  test("should throw", async () => {
    await expect(
      socketTokenMiddleware(options)("args.other_token")(ctx, jest.fn()),
    ).rejects.toThrow();
  });

  test("should resolve optional", async () => {
    await expect(
      socketTokenMiddleware(options)("args.missing_token", true)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.socket.data.tokens.id).toBeUndefined();
  });
});
