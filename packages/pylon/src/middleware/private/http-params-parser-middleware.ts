import { ChangeCase, changeKeys } from "@lindorm/case";
import { ClientError } from "@lindorm/errors";
import { isObject } from "@lindorm/is";
import { parseStringRecord } from "@lindorm/utils";
import { PylonHttpMiddleware } from "../../types";

export const httpParamsParserMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  if (!isObject(ctx.params)) {
    return next();
  }

  try {
    ctx.data = {
      ...ctx.data,
      ...parseStringRecord(changeKeys(ctx.params, ChangeCase.Camel)),
    };
  } catch (err: any) {
    ctx.status = ClientError.Status.BadRequest;
    ctx.body = {
      error: {
        code: err.code ?? "params_parser_middleware_error",
        data: err.data ?? { params: ctx.params },
        message: err.message,
        name: err.name ?? "Error",
        title: err.title ?? "Error",
      },
    };

    throw err;
  }

  await next();
};
