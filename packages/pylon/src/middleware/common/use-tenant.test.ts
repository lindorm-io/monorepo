import { ClientError } from "@lindorm/errors";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { createTestPylonCtx } from "../../mocks/vitest.js";
import { useTenant } from "./use-tenant.js";

describe("useTenant", () => {
  let ctx: Awaited<ReturnType<typeof createTestPylonCtx>>;
  let introspect: Mock;
  let setFilterParams: Mock;
  let next: Mock;

  beforeEach(async () => {
    next = vi.fn();

    ctx = await createTestPylonCtx({
      state: {
        tokens: { accessToken: { payload: { tenantId: "tenant-abc" } } as any },
      },
    });

    introspect = ctx.auth.introspect as unknown as Mock;
    introspect.mockResolvedValue({ active: true, tenantId: "tenant-abc" });
    setFilterParams = ctx.db!.setFilterParams as unknown as Mock;
  });

  // The credential the request already resolved. `useAccessToken` populates it on
  // BOTH provenances, so neither one costs an introspection round trip here.
  describe("default (no path, access resolved)", () => {
    beforeEach(() => {
      ctx.state.access = {
        provenance: "verified",
        custom: {},
        claims: { tenantId: "tenant-resolved" },
        token: "access.token.value",
      };
    });

    test("should read the tenant from the resolved access credential", async () => {
      await useTenant()(ctx, next);

      expect(introspect).not.toHaveBeenCalled();
      expect(ctx.state.tenant).toBe("tenant-resolved");
    });

    test("should read an introspected credential without introspecting again", async () => {
      ctx.state.access = {
        provenance: "introspected",
        custom: {},
        claims: { tenantId: "tenant-resolved" },
        token: "opaque-token",
      };

      await useTenant()(ctx, next);

      expect(introspect).not.toHaveBeenCalled();
      expect(ctx.state.tenant).toBe("tenant-resolved");
    });

    test("should call db.setFilterParams with the resolved tenant", async () => {
      await useTenant()(ctx, next);

      expect(setFilterParams).toHaveBeenCalledWith("__scope", {
        tenantId: "tenant-resolved",
      });
    });

    // The resolved credential is the answer, not a first guess: a credential
    // carrying no tenant is a credential with no tenant, and asking the
    // authorization server the same question again is the second source of truth
    // this middleware exists to avoid.
    test("should throw 403 without introspecting when the credential carries no tenant", async () => {
      ctx.state.access = {
        provenance: "verified",
        custom: {},
        claims: {},
        token: "access.token.value",
      };

      try {
        await useTenant()(ctx, next);
        expect.fail("expected error");
      } catch (err: any) {
        expect(err).toBeInstanceOf(ClientError);
        expect(err.status).toBe(403);
        expect(err.details).toBe("No tenant claim on the resolved access credential");
        expect(err.data).toEqual({ source: "access", path: null });
      }

      expect(introspect).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test("should allow a missing tenant when required is false", async () => {
      ctx.state.access = {
        provenance: "verified",
        custom: {},
        claims: {},
        token: "access.token.value",
      };

      await useTenant(undefined, { required: false })(ctx, next);

      expect(ctx.state.tenant).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // No `useAccessToken` ahead of this mount — nothing resolved a credential, so
  // introspection is the only place left to ask.
  describe("default (no path, no access resolved)", () => {
    test("should extract tenantId from introspection", async () => {
      expect(ctx.state.access).toBeNull();

      await useTenant()(ctx, next);

      expect(introspect).toHaveBeenCalledTimes(1);
      expect(ctx.state.tenant).toBe("tenant-abc");
    });

    test("should call db.setFilterParams with tenantId", async () => {
      await useTenant()(ctx, next);

      expect(setFilterParams).toHaveBeenCalledWith("__scope", {
        tenantId: "tenant-abc",
      });
    });

    test("should throw 403 when required and introspection has no tenantId", async () => {
      introspect.mockResolvedValue({ active: true });

      await expect(useTenant()(ctx, next)).rejects.toThrow(ClientError);

      try {
        await useTenant()(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.details).toBe("No tenant found in token introspection");
      }
    });

    test("should allow missing tenant when required is false", async () => {
      introspect.mockResolvedValue({ active: true });

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

      expect(introspect).not.toHaveBeenCalled();
      expect(ctx.state.tenant).toBe("tenant-from-params");
      expect(setFilterParams).toHaveBeenCalledWith("__scope", {
        tenantId: "tenant-from-params",
      });
    });

    // An explicit path is the operator naming WHERE the tenant lives; it outranks
    // the resolved credential exactly as it always outranked introspection.
    test("should win over the resolved access credential", async () => {
      ctx.state.access = {
        provenance: "verified",
        custom: {},
        claims: { tenantId: "tenant-resolved" },
        token: "access.token.value",
      };
      ctx.params = { tenantId: "tenant-from-params" };

      await useTenant("params.tenantId")(ctx, next);

      expect(ctx.state.tenant).toBe("tenant-from-params");
    });

    test("should read from header path", async () => {
      (ctx as any).headers = { "x-tenant-id": "tenant-from-header" };

      await useTenant("headers.x-tenant-id")(ctx, next);

      expect(ctx.state.tenant).toBe("tenant-from-header");
    });

    test("should read from data path", async () => {
      ctx.data = { tenantId: "tenant-from-data" };

      await useTenant("data.tenantId")(ctx, next);

      expect(ctx.state.tenant).toBe("tenant-from-data");
    });

    test("should read from custom token path", async () => {
      (ctx.state.tokens as any).idToken = { payload: { tenantId: "tenant-from-id" } };

      await useTenant("state.tokens.idToken.payload.tenantId")(ctx, next);

      expect(ctx.state.tenant).toBe("tenant-from-id");
    });

    test("should include path in error details", async () => {
      ctx.state.tokens = {};

      try {
        await useTenant("params.tenantId")(ctx, next);
        expect.fail("expected error");
      } catch (err: any) {
        expect(err.details).toContain("params.tenantId");
      }
    });
  });

  test("should not call setFilterParams when no db on context", async () => {
    const noDbCtx = await createTestPylonCtx({
      state: {
        tokens: { accessToken: { payload: { tenantId: "tenant-abc" } } as any },
      },
      db: null,
    });
    (noDbCtx.auth.introspect as unknown as Mock).mockResolvedValue({
      active: true,
      tenantId: "tenant-abc",
    });

    await useTenant()(noDbCtx, next);

    expect(noDbCtx.state.tenant).toBe("tenant-abc");
  });

  test("should not call setFilterParams when tenantId not found and not required", async () => {
    introspect.mockResolvedValue({ active: true });

    await useTenant(undefined, { required: false })(ctx, next);

    expect(setFilterParams).not.toHaveBeenCalled();
  });
});
