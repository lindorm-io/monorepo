import { ChangeCase, changeKeys } from "@lindorm/case";
import { HttpMethod } from "@lindorm/enums";
import { isObject } from "@lindorm/is";
import { existsSync, mkdirSync } from "fs-extra";
import { BodyType } from "../../enums";
import { ParseBodyOptions, PylonHttpMiddleware } from "../../types";
import { composeParseBodyConfig, getBodyType, parseBody } from "../../utils/private";

export const createHttpBodyParserMiddleware = (
  options?: ParseBodyOptions,
): PylonHttpMiddleware => {
  const config = composeParseBodyConfig(options);

  if (
    config.formidableOptions.uploadDir &&
    !existsSync(config.formidableOptions.uploadDir)
  ) {
    mkdirSync(config.formidableOptions.uploadDir);
  }

  return async function httpBodyParserMiddleware(ctx, next) {
    ctx.data = {};

    if (!config.methods.includes(ctx.method.toUpperCase() as HttpMethod)) {
      return next();
    }

    const bodyType = getBodyType(ctx);
    const { parsed, files, raw } = await parseBody(ctx, config, bodyType);

    ctx.request.body = parsed;
    ctx.request.files = files;
    ctx.request.raw = raw;

    if ([BodyType.Json, BodyType.UrlEncoded].includes(bodyType) && isObject(parsed)) {
      ctx.data = changeKeys(parsed, ChangeCase.Camel);
    }

    await next();
  };
};
