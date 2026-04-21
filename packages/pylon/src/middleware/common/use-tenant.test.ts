import { ClientError } from "@lindorm/errors";
import { useTenant } from "./use-tenant.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("useTenant", () => {
  let ctx: any;
  let next: Mock;

  beforeEach(() => {
    next = vi.fn();

    ctx = {
      auth: {
        introspect: vi.fn().mockResolvedValue({
          active: true,
          tenantId: "tenant-abc",
        }),
      },
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
        setFilterParams: vi.fn(),
      },
    };
  });

  describe("default (no path, ctx.auth available)", () => {
    test("should extract tenantId from introspection", async () => {
      await useTenant()(ctx, next);

      expect(ctx.auth.introspect).toHaveBeenCalledTimes(1);
      expect(ctx.state.tenant).toBe("tenant-abc");
    });

    test("should call proteus.setFilterParams with tenantId", async () => {
      await useTenant()(ctx, next);

      expect(ctx.proteus.setFilterParams).toHaveBeenCalledWith("__scope", {
        tenantId: "tenant-abc",
      });
    });

    test("should throw 403 when required and introspection has no tenantId", async () => {
      ctx.auth.introspect.mockResolvedValue({ active: true });

      await expect(useTenant()(ctx, next)).rejects.toThrow(ClientError);

      try {
        await useTenant()(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.details).toBe("No tenant found in token introspection");
      }
    });

    test("should allow missing tenant when required is false", async () => {
      ctx.auth.introspect.mockResolvedValue({ active: true });

      await useTenant(undefined, { required: false })(ctx, next);

      expect(ctx.state.tenant).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should call next", async () => {
      await useTenant()(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("custom path", () => {
    test("should read from custom path and not call introspect", async () => {
      ctx.params = { tenantId: "tenant-from-params" };

      await useTenant("params.tenantId")(ctx, next);

      expect(ctx.auth.introspect).not.toHaveBeenCalled();
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

    test("should include path in error details", async () => {
      ctx.state.tokens = {};

      try {
        await useTenant("params.tenantId")(ctx, next);
        fail("expected error");
      } catch (err: any) {
        expect(err.details).toContain("params.tenantId");
      }
    });
  });

  test("should not call setFilterParams when proteus not on context", async () => {
    delete ctx.proteus;

    await useTenant()(ctx, next);

    expect(ctx.state.tenant).toBe("tenant-abc");
  });

  test("should not call setFilterParams when tenantId not found and not required", async () => {
    ctx.auth.introspect.mockResolvedValue({ active: true });

    await useTenant(undefined, { required: false })(ctx, next);

    expect(ctx.proteus.setFilterParams).not.toHaveBeenCalled();
  });
});
