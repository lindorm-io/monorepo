import { ServerError } from "@lindorm/errors";
import { useScope } from "./use-scope.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("useScope", () => {
  let ctx: any;
  let next: Mock;

  beforeEach(() => {
    next = vi.fn();

    ctx = {
      proteus: {
        setFilterParams: vi.fn(),
      },
      state: {
        tenant: "tenant-abc",
      },
    };
  });

  test("should call proteus.setFilterParams with params from function", async () => {
    await useScope({ params: (c) => ({ tenantId: c.state.tenant }) })(ctx, next);

    expect(ctx.proteus.setFilterParams).toHaveBeenCalledWith("__scope", {
      tenantId: "tenant-abc",
    });
  });

  test("should throw ServerError when proteus not on context", async () => {
    delete ctx.proteus;

    try {
      await useScope({ params: () => ({}) })(ctx, next);
      fail("expected error");
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

    expect(ctx.proteus.setFilterParams).toHaveBeenCalledWith("__scope", {
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
