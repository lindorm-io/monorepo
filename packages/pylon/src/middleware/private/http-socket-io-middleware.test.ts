import { httpSocketIoMiddleware } from "./http-socket-io-middleware";

describe("createHttpSocketIoMiddleware", () => {
  let ctx: any;
  let socketIo: any;

  beforeEach(() => {
    ctx = {};
    socketIo = "socketIo";
  });

  test("should resolve", async () => {
    await expect(
      httpSocketIoMiddleware(socketIo)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.io).toEqual("socketIo");
  });
});
