import { ChangeCase, changeKeys } from "@lindorm/case";
import { HttpMethod } from "@lindorm/enums";
import { ClientError } from "@lindorm/errors";
import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
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
    try {
      if (isObject(ctx.query)) {
        const query: Dict = changeKeys(ctx.query, ChangeCase.Camel);

        for (const [key, value] of Object.entries(query)) {
          query[key] = decodeURIComponent(value);
        }

        ctx.data = query;
      } else {
        ctx.data = {};
      }

      if (!config.methods.includes(ctx.method.toUpperCase() as HttpMethod)) {
        return next();
      }

      const bodyType = getBodyType(ctx);
      const { parsed, files, raw } = await parseBody(ctx, config, bodyType);

      ctx.request.body = parsed;
      ctx.request.files = files;
      ctx.request.raw = raw;

      if (
        [BodyType.Json, BodyType.UrlEncoded].includes(bodyType) &&
        (isObject(parsed) || isArray(parsed))
      ) {
        ctx.data = { ...ctx.data, ...changeKeys(parsed, ChangeCase.Camel) };
      }
    } catch (err: any) {
      ctx.status = ClientError.Status.BadRequest;
      ctx.body = {
        error: {
          code: err.code ?? "unknown_error",
          data: err.data ?? {},
          message: err.message,
          name: err.name ?? "Error",
          title: err.title ?? "Error",
        },
      };

      throw err;
    }

    await next();
  };
};
