import { ServerError } from "@lindorm/errors";
import { ZodArray, ZodObject, ZodRawShape, ZodTypeAny } from "zod";
import { ConduitError } from "../errors";
import { ConduitMiddleware } from "../types";

export const conduitSchemaMiddleware = <T extends ZodRawShape>(
  schema: ZodObject<T> | ZodArray<ZodTypeAny>,
): ConduitMiddleware =>
  async function conduitSchemaMiddleware(ctx, next) {
    await next();

    try {
      if (schema instanceof ZodObject) {
        ctx.res.data = schema.passthrough().parse(ctx.res.data);
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
