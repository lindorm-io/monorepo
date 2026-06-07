import { BadGatewayError, ServerError } from "@lindorm/errors";
import { z, ZodArray, ZodObject, type ZodRawShape } from "zod";
import type { ConduitMiddleware } from "../types/index.js";

export const conduitSchemaMiddleware = <T extends ZodRawShape>(
  schema: ZodObject<T> | ZodArray<z.ZodType>,
): ConduitMiddleware =>
  async function conduitSchemaMiddleware(ctx, next) {
    await next();

    if (!(schema instanceof ZodObject) && !(schema instanceof ZodArray)) {
      throw new ServerError("Invalid Zod schema provided", {
        code: "invalid_zod_schema",
        type: "urn:lindorm:conduit:error:invalid_zod_schema",
      });
    }

    try {
      if (schema instanceof ZodObject) {
        ctx.res.data = schema.loose().parse(ctx.res.data);
      } else {
        ctx.res.data = schema.parse(ctx.res.data);
      }
    } catch (err: any) {
      throw new BadGatewayError(err.message, {
        code: "response_schema_validation_failed",
        type: "urn:lindorm:conduit:error:response_schema_validation_failed",
        error: err,
        debug: { issues: err.details },
      });
    }
  };
