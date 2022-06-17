import { ClientError } from "@lindorm-io/errors";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { flatten, get, isFunction, isString, uniq } from "lodash";
import {
  TokenCustomValidation,
  DefaultLindormJwtKoaMiddleware,
  TokenValidationMiddlewareConfig,
} from "../types";

export interface TokenValidationOptions {
  adjustedAccessLevel?: LevelOfAssurance;
  audiences?: Array<string>;
  levelOfAssurance?: LevelOfAssurance;
  maxAge?: string;
  permissions?: Array<string>;
  scopes?: Array<string>;

  fromPath?: {
    audience?: string;
    nonce?: string;
    subject?: string;
  };

  optional?: boolean;
}

export const tokenValidationMiddleware =
  (config: TokenValidationMiddlewareConfig) =>
  (
    path: string,
    options: TokenValidationOptions = {},
    customValidation?: TokenCustomValidation,
  ): DefaultLindormJwtKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("token");

    const { clockTolerance, contextKey, issuer, subjectHint, types } = config;

    const { adjustedAccessLevel, fromPath, levelOfAssurance, maxAge, permissions, scopes } =
      options;

    const token = get(ctx, path);

    const audiences = uniq(flatten([config.audiences || [], options.audiences || []]));

    try {
      if (!isString(token)) {
        throw new ClientError("Token not found", {
          debug: { middlewareOptions: config, options, path, token },
        });
      }

      ctx.token[contextKey] = ctx.jwt.verify(token, {
        adjustedAccessLevel,
        audience: fromPath?.audience ? get(ctx, fromPath.audience) : undefined,
        audiences: audiences.length ? audiences : undefined,
        clockTolerance,
        issuer,
        levelOfAssurance,
        maxAge,
        nonce: fromPath?.nonce ? get(ctx, fromPath.nonce) : undefined,
        permissions,
        scopes,
        subject: fromPath?.subject ? get(ctx, fromPath.subject) : undefined,
        subjectHint,
        types,
      });

      if (isFunction(customValidation)) {
        await customValidation(ctx, ctx.token[contextKey]);
      }

      ctx.logger.debug("token validated", {
        [contextKey]: token,
      });
    } catch (err: any) {
      if (options.optional) {
        ctx.logger.debug("optional error ignored", err);
      } else {
        throw new ClientError(err.message || "Invalid token", {
          error: err,
          debug: { config, options },
          description: `${contextKey} is invalid`,
          statusCode: ClientError.StatusCode.UNAUTHORIZED,
        });
      }
    } finally {
      metric.end();
    }

    await next();
  };
