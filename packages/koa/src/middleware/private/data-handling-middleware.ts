import { DefaultLindormMiddleware } from "../../types";
import { camelCase, snakeCase } from "@lindorm-io/case";
import { isObject } from "@lindorm-io/core";

export const dataHandlingMiddleware: DefaultLindormMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const body = isObject(ctx.request.body) ? camelCase(ctx.request.body) : {};
  const query = isObject(ctx.query) ? camelCase<Record<string, string>>(ctx.query) : {};

  for (const [key, value] of Object.entries(query)) {
    query[key] = decodeURIComponent(value);
  }

  ctx.data = {
    ...body,
    ...query,
  };

  await next();

  ctx.body = isObject(ctx.body) ? snakeCase(ctx.body) : ctx.body;
};
