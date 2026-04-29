import { BadGatewayError, ServerError } from "@lindorm/errors";
import { z, ZodArray, ZodObject, type ZodRawShape } from "zod";
import type { ConduitMiddleware } from "../types/index.js";

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
      throw new BadGatewayError(err.message, {
        error: err,
        data: err.details,
      });
    }
  };
