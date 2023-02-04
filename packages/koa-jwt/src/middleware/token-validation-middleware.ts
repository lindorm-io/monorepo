import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { get } from "object-path";
import {
  TokenCustomValidation,
  DefaultLindormJwtKoaMiddleware,
  TokenValidationMiddlewareConfig,
} from "../types";

export interface TokenValidationOptions {
  adjustedAccessLevel?: AdjustedAccessLevel;
  audiences?: Array<string>;
  levelOfAssurance?: LevelOfAssurance;
  maxAge?: string;
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

    const { adjustedAccessLevel, fromPath, levelOfAssurance, maxAge, scopes } = options;

    const token = get(ctx, path);

    const audiences = [...new Set([config.audiences || [], options.audiences || []].flat())];

    try {
      if (typeof token !== "string") {
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
        scopes,
        subject: fromPath?.subject ? get(ctx, fromPath.subject) : undefined,
        subjectHint,
        types,
      });

      if (customValidation instanceof Function) {
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
