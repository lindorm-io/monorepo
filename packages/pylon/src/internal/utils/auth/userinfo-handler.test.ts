import { ClientError } from "@lindorm/errors";
import { getAuthClient as _getAuthClient } from "./get-auth-client";
import { createUserinfoHandler } from "./userinfo-handler";

jest.mock("./get-auth-client");

const getAuthClient = _getAuthClient as jest.Mock;

describe("createUserinfoHandler", () => {
  let config: any;
  let ctx: any;

  beforeEach(() => {
    config = {};

    ctx = {
      state: {
        session: {},
      },
    };

    getAuthClient.mockReturnValue({
      userinfo: jest.fn().mockResolvedValue({ userinfo: true }),
    });
  });

  test("should resolve", async () => {
    await expect(createUserinfoHandler(config)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({ userinfo: true });
    expect(ctx.status).toEqual(200);
  });

  test("should throw if session not found", async () => {
    ctx.state.session = undefined;

    await expect(createUserinfoHandler(config)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
