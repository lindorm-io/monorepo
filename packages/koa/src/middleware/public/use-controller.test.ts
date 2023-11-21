import { TransformMode } from "@lindorm-io/case";
import { createMockLogger } from "@lindorm-io/core-logger";
import { createURL } from "@lindorm-io/url";
import { HttpStatus } from "../../constant";
import { Controller, ControllerResponse } from "../../types";
import { useController } from "./use-controller";

describe("useController", () => {
  let ctx: any;
  let next: any;

  const logger = createMockLogger();

  beforeEach(() => {
    ctx = {
      logger,
      getMetric: jest.fn(() => ({ end: jest.fn() })),
      redirect: jest.fn(),
      request: { body: { string: "string" } },
    };
    next = () => Promise.resolve();
  });

  afterEach(jest.clearAllMocks);

  test("should resolve status and body", async () => {
    const controller: Controller = async (): ControllerResponse => ({
      status: HttpStatus.Success.CREATED,
      body: { response: "body" },
    });

    await expect(useController(controller)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({ response: "body" });
    expect(ctx.status).toStrictEqual(201);
    expect(ctx.redirect).not.toHaveBeenCalled();
  });

  test("should pass ctx into controller function", async () => {
    const controller: Controller = async (ctx): ControllerResponse => ({
      status: HttpStatus.Success.CREATED,
      body: { ctx: ctx.request.body },
    });

    await expect(useController(controller)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({ ctx: { string: "string" } });
    expect(ctx.status).toStrictEqual(201);
    expect(ctx.redirect).not.toHaveBeenCalled();
  });

  test("should automatically set body", async () => {
    const controller: Controller = async (): ControllerResponse => ({
      status: HttpStatus.Success.CREATED,
    });

    await expect(useController(controller)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({});
    expect(ctx.status).toStrictEqual(201);
  });

  test("should automatically determine status as OK", async () => {
    const controller: Controller = async (ctx): ControllerResponse => ({
      body: ctx.request.body as any,
    });

    await expect(useController(controller)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({ string: "string" });
    expect(ctx.status).toStrictEqual(200);
  });

  test("should automatically determine status as NO_CONTENT on empty object", async () => {
    const controller: Controller = async (): ControllerResponse => ({});

    await expect(useController(controller)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
    expect(ctx.status).toStrictEqual(204);
  });

  test("should automatically determine status as NO_CONTENT on void", async () => {
    const controller: Controller = async (): ControllerResponse => {};

    await expect(useController(controller)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
    expect(ctx.status).toStrictEqual(204);
  });

  test("should resolve redirect with URL", async () => {
    const controller: Controller = async (): ControllerResponse => ({
      redirect: createURL("https://test.lindorm.io/:param/one", {
        params: {
          param: 1,
        },
        query: {
          queryOne: "string",
          twoNumber: 22,
        },
        queryCaseTransform: TransformMode.SNAKE,
      }),
    });

    await expect(useController(controller)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({});
    expect(ctx.status).toBe(302);
    expect(ctx.redirect).toHaveBeenCalledWith(
      "https://test.lindorm.io/1/one?query_one=string&two_number=22",
    );
  });

  test("should resolve redirect with string", async () => {
    const controller: Controller = async (): ControllerResponse => ({
      redirect: "https://test.lindorm.io/",
    });

    await expect(useController(controller)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({});
    expect(ctx.status).toBe(302);
    expect(ctx.redirect).toHaveBeenCalledWith("https://test.lindorm.io/");
  });

  test("should resolve redirect with body", async () => {
    const controller: Controller = async (ctx): ControllerResponse => ({
      redirect: "https://test.lindorm.io/",
      body: ctx.request.body as any,
    });

    await expect(useController(controller)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.body).toStrictEqual({ string: "string" });
    expect(ctx.status).toBe(308);
    expect(ctx.redirect).toHaveBeenCalledWith("https://test.lindorm.io/");
  });
});
