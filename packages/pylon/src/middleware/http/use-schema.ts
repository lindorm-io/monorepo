import { ClientError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { get } from "object-path";
import { ZodSchema } from "zod";
import { PylonHttpContext, PylonHttpMiddleware } from "../../types";

type From = "data" | "body" | "headers" | "params" | "query" | string;

const destructHeaders = (ctx: PylonHttpContext): Record<string, string> => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(ctx.headers)) {
    result[key] = value;
  }

  return result;
};

export const useSchema = (schema: ZodSchema, from: From = "data"): PylonHttpMiddleware =>
  async function httpSchemaMiddleware(ctx, next): Promise<void> {
    try {
      const input = from === "headers" ? destructHeaders(ctx) : get(ctx, from);
      schema.parse(input);
    } catch (err: any) {
      throw new ClientError(err.message, {
        error: err,
        data: err.details,
      });
    }

    await next();
  };
