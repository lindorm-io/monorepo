import { ClientError } from "@lindorm/errors";
import { z } from "zod";
import { useSchema } from "./use-schema";

describe("useSchema", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        key: "value",
        number: "123",
      },
      headers: {
        "header-boolean": "true",
        "header-ignore": "ignore",
        "header-key": "header-value",
      },
    };
  });

  test("should resolve", async () => {
    await expect(
      useSchema(
        z.object({
          key: z.string(),
          number: z.coerce.number(),
        }),
      )(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.data).toEqual({
      key: "value",
      number: 123,
    });
  });

  test("should resolve with headers", async () => {
    await expect(
      useSchema(
        z.object({
          "header-boolean": z.coerce.boolean(),
          "header-key": z.string(),
        }),
        "headers",
      )(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.data).toEqual({
      key: "value",
      number: "123",
    });
    expect(ctx.headers).toEqual({
      "header-boolean": true,
      "header-ignore": "ignore",
      "header-key": "header-value",
    });
  });

  test("should throw", async () => {
    ctx.data.number = "not-a-number";

    await expect(
      useSchema(
        z.object({
          key: z.string(),
          number: z.coerce.number(),
        }),
      )(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);
  });
});
