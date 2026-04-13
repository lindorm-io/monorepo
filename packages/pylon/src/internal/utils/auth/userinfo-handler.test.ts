import { ClientError } from "@lindorm/errors";
import { createUserinfoHandler } from "./userinfo-handler";

describe("createUserinfoHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      auth: {
        userinfo: jest.fn().mockResolvedValue({ userinfo: true }),
      },
      state: {
        session: {},
      },
    };
  });

  test("should resolve", async () => {
    await expect(createUserinfoHandler()(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({ userinfo: true });
    expect(ctx.status).toEqual(200);
  });

  test("should throw if session not found", async () => {
    ctx.state.session = undefined;

    await expect(createUserinfoHandler()(ctx, jest.fn())).rejects.toThrow(ClientError);
  });
});
