import Joi from "joi";
import { useSchema } from "./use-schema";
import { ClientError } from "@lindorm-io/errors";

const next = () => Promise.resolve();

describe("useSchema", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { string: "string", number: 12345 },
    };
  });

  test("should resolve with validation", async () => {
    await expect(
      useSchema(
        Joi.object({
          string: Joi.string().required(),
          number: Joi.number().required(),
        }),
      )(ctx, next),
    ).resolves.toBeUndefined();
  });

  test("should throw ClientError", async () => {
    await expect(
      useSchema(
        Joi.object({
          string: Joi.number().required(),
          number: Joi.string().required(),
        }),
      )(ctx, next),
    ).rejects.toThrow(ClientError);
  });
});
