import { transformCase } from "@lindorm-io/case";
import { isObject } from "@lindorm-io/core";
import { DefaultLindormMiddleware } from "../../types";

export const responseDataMiddleware: DefaultLindormMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  await next();

  ctx.body = isObject(ctx.body) ? transformCase(ctx.body, ctx.config.transformMode) : ctx.body;
};
