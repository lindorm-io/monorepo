import { createHealthRouter } from "./create-health-router";

describe("createHealthRouter", () => {
  test("should create a router with a GET / route", () => {
    const router = createHealthRouter();

    const getRoutes = router.stack.filter(
      (layer) => layer.methods.includes("GET") && layer.path === "/",
    );

    expect(getRoutes).toHaveLength(1);
  });

  test("should invoke callback when provided and set status 204", async () => {
    const callback = jest.fn();
    const router = createHealthRouter(callback);

    const layer = router.stack.find((l) => l.methods.includes("GET") && l.path === "/");

    const ctx: any = { body: null, status: 0 };
    const next = jest.fn();

    // koa-router stores middleware in layer.stack
    for (const middleware of layer!.stack) {
      await middleware(ctx, next);
    }

    expect(callback).toHaveBeenCalledWith(ctx);
    expect(ctx.status).toBe(204);
    expect(ctx.body).toBeUndefined();
  });

  test("should set status 204 without callback", async () => {
    const router = createHealthRouter();

    const layer = router.stack.find((l) => l.methods.includes("GET") && l.path === "/");

    const ctx: any = { body: null, status: 0 };
    const next = jest.fn();

    for (const middleware of layer!.stack) {
      await middleware(ctx, next);
    }

    expect(ctx.status).toBe(204);
    expect(ctx.body).toBeUndefined();
  });
});
