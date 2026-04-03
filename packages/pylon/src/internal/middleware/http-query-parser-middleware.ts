import { changeKeys } from "@lindorm/case";
import { isObject } from "@lindorm/is";
import { parseStringRecord } from "@lindorm/utils";
import { PylonHttpMiddleware } from "../../types";

export const httpQueryParserMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  if (!isObject(ctx.query)) {
    return next();
  }

  ctx.data = {
    ...ctx.data,
    ...parseStringRecord(changeKeys(ctx.query, "camel")),
  };

  await next();
};
