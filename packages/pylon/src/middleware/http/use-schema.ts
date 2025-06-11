import { ClientError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { get, set } from "object-path";
import { ZodObject, ZodRawShape } from "zod";
import { PylonHttpContext, PylonHttpMiddleware } from "../../types";

type From = "data" | "body" | "headers" | "params" | "query" | string;

const destructHeaders = (ctx: PylonHttpContext): Dict<string> => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(ctx.headers)) {
    result[key] = value;
  }

  return result;
};

export const useSchema = <T extends ZodRawShape>(
  schema: ZodObject<T>,
  path: From = "data",
): PylonHttpMiddleware =>
  async function httpSchemaMiddleware(ctx, next): Promise<void> {
    try {
      const input = path === "headers" ? destructHeaders(ctx) : get(ctx, path);
      const output = schema.passthrough().parse(input);

      set(ctx, path, output);
    } catch (error: any) {
      throw new ClientError(error.message, {
        error,
        data: error.details,
      });
    }

    await next();
  };
