import { z } from "zod";
import { useSchema } from "./use-schema";

describe("useSchema", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        key: "value",
      },
      headers: {
        "header-key": "header-value",
      },
    };
  });

  test("should resolve", async () => {
    await expect(
      useSchema(
        z.object({
          key: z.string(),
        }),
      )(ctx, jest.fn()),
    ).resolves.toBeUndefined();
  });

  test("should resolve with headers", async () => {
    await expect(
      useSchema(
        z.object({
          "header-key": z.string(),
        }),
        "headers",
      )(ctx, jest.fn()),
    ).resolves.toBeUndefined();
  });
});
