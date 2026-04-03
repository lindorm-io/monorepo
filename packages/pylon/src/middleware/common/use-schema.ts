import { isHttpContext } from "#internal/utils/is-context";
import { ClientError, ServerError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { get, set } from "object-path";
import { ZodObject, ZodRawShape } from "zod/v4";
import { PylonHttpContext, PylonMiddleware } from "../../types";

type Path = "data" | "body" | "headers" | "params" | "query" | string;

const HTTP_ONLY_PATHS = ["headers", "body", "query"];

const destructHeaders = (ctx: PylonHttpContext): Dict<string> => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(ctx.headers)) {
    result[key] = value;
  }

  return result;
};

export const useSchema = <T extends ZodRawShape>(
  schema: ZodObject<T>,
  path: Path = "data",
): PylonMiddleware =>
  async function schemaMiddleware(ctx, next): Promise<void> {
    if (HTTP_ONLY_PATHS.includes(path) && !isHttpContext(ctx)) {
      throw new ServerError(`Schema path "${path}" is only available on HTTP contexts`);
    }

    try {
      const input =
        path === "headers" && isHttpContext(ctx) ? destructHeaders(ctx) : get(ctx, path);
      const output = schema.loose().parse(input);

      set(ctx, path, output);
    } catch (error: any) {
      throw new ClientError(error.message, {
        error,
        data: error.details,
      });
    }

    await next();
  };
