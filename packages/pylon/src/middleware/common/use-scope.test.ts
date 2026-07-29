import { ServerError } from "@lindorm/errors";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { createTestPylonCtx } from "../../mocks/vitest.js";
import { useScope } from "./use-scope.js";

describe("useScope", () => {
  let ctx: Awaited<ReturnType<typeof createTestPylonCtx>>;
  let next: Mock;

  beforeEach(async () => {
    next = vi.fn();
    ctx = await createTestPylonCtx({ state: { tenant: "tenant-abc" } });
  });

  test("should call db.setFilterParams with params from function", async () => {
    await useScope({ params: (c) => ({ tenantId: c.state.tenant }) })(ctx, next);

    expect(ctx.db!.setFilterParams).toHaveBeenCalledWith("__scope", {
      tenantId: "tenant-abc",
    });
  });

  test("should throw ServerError when no db on context", async () => {
    const noDbCtx = await createTestPylonCtx({ db: null });

    try {
      await useScope({ params: () => ({}) })(noDbCtx, next);
      expect.fail("expected error");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ServerError);
      expect(err.message).toMatchSnapshot();
    }
  });

  test("should support multi-dimensional scope params", async () => {
    await useScope({
      params: () => ({
        tenantId: "tenant-abc",
        regionId: "eu-west-1",
        orgUnit: "engineering",
      }),
    })(ctx, next);

    expect(ctx.db!.setFilterParams).toHaveBeenCalledWith("__scope", {
      tenantId: "tenant-abc",
      regionId: "eu-west-1",
      orgUnit: "engineering",
    });
  });

  test("should call next", async () => {
    await useScope({ params: () => ({ tenantId: "t" }) })(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
