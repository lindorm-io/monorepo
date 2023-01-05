import { DefaultLindormMiddleware } from "../../types";
import { camelCase, snakeCase } from "@lindorm-io/case";
import { isObjectStrict } from "@lindorm-io/core";

export const dataHandlingMiddleware: DefaultLindormMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const body = isObjectStrict(ctx.request.body) ? camelCase(ctx.request.body) : {};
  const query = isObjectStrict(ctx.query) ? camelCase<Record<string, string>>(ctx.query) : {};

  for (const [key, value] of Object.entries(query)) {
    query[key] = decodeURIComponent(value);
  }

  ctx.data = {
    ...body,
    ...query,
  };

  await next();

  ctx.body = isObjectStrict(ctx.body) ? snakeCase(ctx.body) : ctx.body;
};
