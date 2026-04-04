import { ClientError } from "@lindorm/errors";
import { useTenant } from "./use-tenant";

describe("useTenant", () => {
  let ctx: any;
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();

    ctx = {
      state: {
        tokens: {
          accessToken: {
            payload: {
              tenantId: "tenant-abc",
            },
          },
        },
      },
      proteus: {
        setFilterParams: jest.fn(),
      },
    };
  });

  test("should extract tenantId from default token path", async () => {
    await useTenant()(ctx, next);

    expect(ctx.state.tenant).toBe("tenant-abc");
  });

  test("should call proteus.setFilterParams with tenantId", async () => {
    await useTenant()(ctx, next);

    expect(ctx.proteus.setFilterParams).toHaveBeenCalledWith("__scope", {
      tenantId: "tenant-abc",
    });
  });

  test("should throw 403 when required and no tenant found", async () => {
    ctx.state.tokens.accessToken.payload.tenantId = undefined;

    await expect(useTenant()(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should allow missing tenant when required is false", async () => {
    ctx.state.tokens.accessToken.payload.tenantId = undefined;

    await useTenant(undefined, { required: false })(ctx, next);

    expect(ctx.state.tenant).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should read from custom path", async () => {
    ctx.params = { tenantId: "tenant-from-params" };

    await useTenant("params.tenantId")(ctx, next);

    expect(ctx.state.tenant).toBe("tenant-from-params");
    expect(ctx.proteus.setFilterParams).toHaveBeenCalledWith("__scope", {
      tenantId: "tenant-from-params",
    });
  });

  test("should read from header path", async () => {
    ctx.headers = { "x-tenant-id": "tenant-from-header" };

    await useTenant("headers.x-tenant-id")(ctx, next);

    expect(ctx.state.tenant).toBe("tenant-from-header");
  });

  test("should read from data path", async () => {
    ctx.data = { tenantId: "tenant-from-data" };

    await useTenant("data.tenantId")(ctx, next);

    expect(ctx.state.tenant).toBe("tenant-from-data");
  });

  test("should read from custom token path", async () => {
    ctx.state.tokens.idToken = { payload: { tenantId: "tenant-from-id" } };

    await useTenant("state.tokens.idToken.payload.tenantId")(ctx, next);

    expect(ctx.state.tenant).toBe("tenant-from-id");
  });

  test("should set ctx.state.tenant to null when not required and not found", async () => {
    ctx.state.tokens = {};

    await useTenant(undefined, { required: false })(ctx, next);

    expect(ctx.state.tenant).toBeNull();
  });

  test("should not call setFilterParams when proteus not on context", async () => {
    delete ctx.proteus;

    await useTenant()(ctx, next);

    expect(ctx.state.tenant).toBe("tenant-abc");
  });

  test("should not call setFilterParams when tenantId not found and not required", async () => {
    ctx.state.tokens = {};

    await useTenant(undefined, { required: false })(ctx, next);

    expect(ctx.proteus.setFilterParams).not.toHaveBeenCalled();
  });

  test("should include path in error details", async () => {
    ctx.state.tokens = {};

    try {
      await useTenant("params.tenantId")(ctx, next);
      fail("expected error");
    } catch (err: any) {
      expect(err.details).toContain("params.tenantId");
    }
  });

  test("should call next", async () => {
    await useTenant()(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
