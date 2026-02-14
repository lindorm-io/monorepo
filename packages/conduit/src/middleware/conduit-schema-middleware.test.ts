import z from "zod";
import { ConduitError } from "../errors";
import { conduitSchemaMiddleware } from "./conduit-schema-middleware";

describe("conduitSchemaMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      res: {
        data: {
          key: "value",
          number: "123",
        },
      },
    };
  });

  test("should validate response data populated by next()", async () => {
    const next = jest.fn(async () => {
      ctx.res.data = {
        key: "value",
        number: "123",
      };
    });

    ctx.res.data = {};

    await expect(
      conduitSchemaMiddleware(
        z.object({
          key: z.string(),
          number: z.coerce.number(),
        }),
      )(ctx, next),
    ).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.res.data).toEqual({
      key: "value",
      number: 123,
    });
  });

  test("should resolve object", async () => {
    await expect(
      conduitSchemaMiddleware(
        z.object({
          key: z.string(),
          number: z.coerce.number(),
        }),
      )(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.res.data).toEqual({
      key: "value",
      number: 123,
    });
  });

  test("should resolve array", async () => {
    ctx.res.data = [
      { key: "value", number: "123" },
      { key: "another", number: "456" },
    ];
    await expect(
      conduitSchemaMiddleware(
        z.array(z.object({ key: z.string(), number: z.coerce.number() })),
      )(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.res.data).toEqual([
      {
        key: "value",
        number: 123,
      },
      {
        key: "another",
        number: 456,
      },
    ]);
  });

  test("should throw", async () => {
    ctx.res.data.number = "not-a-number";

    await expect(
      conduitSchemaMiddleware(
        z.object({
          key: z.string(),
          number: z.coerce.number(),
        }),
      )(ctx, jest.fn()),
    ).rejects.toThrow(ConduitError);
  });
});
