import { ServerError } from "@lindorm/errors";
import { z, ZodArray, ZodObject, ZodRawShape } from "zod/v4";
import { ConduitError } from "../errors";
import { ConduitMiddleware } from "../types";

export const conduitSchemaMiddleware = <T extends ZodRawShape>(
  schema: ZodObject<T> | ZodArray<z.ZodType>,
): ConduitMiddleware =>
  async function conduitSchemaMiddleware(ctx, next) {
    await next();

    try {
      if (schema instanceof ZodObject) {
        ctx.res.data = schema.loose().parse(ctx.res.data);
      } else if (schema instanceof ZodArray) {
        ctx.res.data = schema.parse(ctx.res.data);
      } else {
        throw new ServerError("Invalid Zod schema provided");
      }
    } catch (err: any) {
      throw new ConduitError(err.message, {
        error: err,
        data: err.details,
      });
    }
  };
