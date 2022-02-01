import { Controller } from "../../types";
import { HttpStatus } from "../../constant";
import { createURL } from "@lindorm-io/core";
import { logger } from "../../test";
import { useController } from "./use-controller";

describe("useController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger,
      getMetric: jest.fn(() => ({ end: jest.fn() })),
      redirect: jest.fn(),
      request: { body: { string: "string" } },
    };
  });

  afterEach(jest.clearAllMocks);

  test("should resolve status and body", async () => {
    const testController: Controller = async (ctx) => ({
      status: HttpStatus.Success.CREATED,
      body: ctx.request.body,
    });

    await expect(useController(testController)(ctx)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({ string: "string" });
    expect(ctx.status).toStrictEqual(201);
    expect(ctx.redirect).not.toHaveBeenCalled();
    expect(ctx.getMetric).toHaveBeenCalledWith("testController");
  });

  test("should automatically determine body", async () => {
    const controller: Controller = async () => ({
      status: HttpStatus.Success.CREATED,
    });

    await expect(useController(controller)(ctx)).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
    expect(ctx.status).toStrictEqual(201);
  });

  test("should automatically determine status as OK", async () => {
    const controller: Controller = async (ctx) => ({
      body: ctx.request.body,
    });

    await expect(useController(controller)(ctx)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({ string: "string" });
    expect(ctx.status).toStrictEqual(200);
  });

  test("should automatically determine status as NO_CONTENT", async () => {
    const controller: Controller = async () => ({});

    await expect(useController(controller)(ctx)).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
    expect(ctx.status).toStrictEqual(204);
  });

  test("should resolve redirect with URL", async () => {
    const controller: Controller = async () => ({
      redirect: createURL("https://test.lindorm.io/:param/one", {
        params: {
          param: 1,
        },
        query: {
          queryOne: "string",
          twoNumber: 22,
        },
      }),
    });

    await expect(useController(controller)(ctx)).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
    expect(ctx.status).toBe(302);
    expect(ctx.redirect).toHaveBeenCalledWith(
      "https://test.lindorm.io/1/one?query_one=string&two_number=22",
    );
  });

  test("should resolve redirect with String", async () => {
    const controller: Controller = async () => ({
      redirect: "https://test.lindorm.io/",
    });

    await expect(useController(controller)(ctx)).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
    expect(ctx.status).toBe(302);
    expect(ctx.redirect).toHaveBeenCalledWith("https://test.lindorm.io/");
  });

  test("should resolve redirect with body", async () => {
    const controller: Controller = async (ctx) => ({
      redirect: "https://test.lindorm.io/",
      body: ctx.request.body,
    });

    await expect(useController(controller)(ctx)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({ string: "string" });
    expect(ctx.status).toBe(308);
    expect(ctx.redirect).toHaveBeenCalledWith("https://test.lindorm.io/");
  });
});
