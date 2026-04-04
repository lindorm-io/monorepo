import { ClientError } from "@lindorm/errors";
import { isHttpContext } from "#internal/utils/is-context";
import { useTenant } from "./use-tenant";

jest.mock("#internal/utils/is-context");

const mockIsHttpContext = isHttpContext as jest.MockedFunction<typeof isHttpContext>;

describe("useTenant", () => {
  let ctx: any;
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
    mockIsHttpContext.mockReturnValue(false);

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

  test("should extract tenantId from token payload and set on ctx.state.tenant", async () => {
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

    try {
      await useTenant()(ctx, next);
      fail("expected error");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ClientError);
      expect(err.status).toBe(403);
      expect(err.message).toMatchSnapshot();
      expect(err.code).toMatchSnapshot();
    }
  });

  test("should allow missing tenant when required is false", async () => {
    ctx.state.tokens.accessToken.payload.tenantId = undefined;

    await useTenant({ required: false })(ctx, next);

    expect(ctx.state.tenant).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should fall back to header on HTTP context when token has no tenantId", async () => {
    ctx.state.tokens.accessToken.payload.tenantId = undefined;
    ctx.get = jest.fn().mockReturnValue("tenant-from-header");
    mockIsHttpContext.mockReturnValue(true);

    await useTenant({ header: "x-tenant-id" })(ctx, next);

    expect(ctx.state.tenant).toBe("tenant-from-header");
    expect(ctx.get).toHaveBeenCalledWith("x-tenant-id");
    expect(ctx.proteus.setFilterParams).toHaveBeenCalledWith("__scope", {
      tenantId: "tenant-from-header",
    });
  });

  test("should not check header on socket context", async () => {
    ctx.state.tokens.accessToken.payload.tenantId = undefined;
    ctx.get = jest.fn();
    mockIsHttpContext.mockReturnValue(false);

    await expect(useTenant({ header: "x-tenant-id" })(ctx, next)).rejects.toThrow(
      ClientError,
    );

    expect(ctx.get).not.toHaveBeenCalled();
  });

  test("should use custom token key", async () => {
    ctx.state.tokens.idToken = {
      payload: { tenantId: "tenant-from-id" },
    };

    await useTenant({ token: "idToken" })(ctx, next);

    expect(ctx.state.tenant).toBe("tenant-from-id");
  });

  test("should set ctx.state.tenant to null when not required and not found", async () => {
    ctx.state.tokens = {};

    await useTenant({ required: false })(ctx, next);

    expect(ctx.state.tenant).toBeNull();
  });

  test("should not call setFilterParams when proteus not on context", async () => {
    delete ctx.proteus;

    await useTenant()(ctx, next);

    expect(ctx.state.tenant).toBe("tenant-abc");
  });

  test("should not call setFilterParams when tenantId not found and not required", async () => {
    ctx.state.tokens = {};

    await useTenant({ required: false })(ctx, next);

    expect(ctx.proteus.setFilterParams).not.toHaveBeenCalled();
  });

  test("should call next", async () => {
    await useTenant()(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
