import { ClientError } from "@lindorm/errors";
import { createIntrospectHandler } from "./introspect-handler";

describe("createIntrospectHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      auth: {
        introspect: jest.fn().mockResolvedValue({ active: true }),
      },
      state: {
        session: {},
      },
    };
  });

  test("should resolve", async () => {
    await expect(createIntrospectHandler()(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({ active: true });
    expect(ctx.status).toEqual(200);
  });

  test("should throw if session not found", async () => {
    ctx.state.session = undefined;

    await expect(createIntrospectHandler()(ctx, jest.fn())).rejects.toThrow(ClientError);
  });
});
