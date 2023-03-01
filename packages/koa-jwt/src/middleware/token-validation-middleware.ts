import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { get } from "object-path";
import {
  DefaultLindormJwtKoaMiddleware,
  TokenCustomValidation,
  TokenValidationMiddlewareConfig,
} from "../types";

export type TokenValidationOptions = {
  adjustedAccessLevel?: AdjustedAccessLevel;
  levelOfAssurance?: LevelOfAssurance;
  maxAge?: string | number;
  scopes?: string[];

  fromPath?: {
    nonce?: string;
    subject?: string;
  };

  optional?: boolean;
};

export const tokenValidationMiddleware =
  (config: TokenValidationMiddlewareConfig) =>
  (
    path: string,
    options: TokenValidationOptions = {},
    customValidation?: TokenCustomValidation,
  ): DefaultLindormJwtKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("token");

    const { audience, clockTolerance, contextKey, issuer, subjectHints, tenant, types } = config;
    const { adjustedAccessLevel, levelOfAssurance, maxAge, scopes, fromPath = {} } = options;
    const { nonce, subject } = fromPath;

    try {
      const token = get(ctx, path);

      if (typeof token !== "string") {
        throw new ClientError("Token not found", {
          debug: { middlewareOptions: config, options, path, token },
        });
      }

      ctx.token[contextKey] = ctx.jwt.verify(token, {
        adjustedAccessLevel,
        audience,
        clockTolerance,
        issuer,
        levelOfAssurance,
        maxAge,
        nonce: nonce ? get(ctx, nonce) : undefined,
        scopes,
        subject: subject ? get(ctx, subject) : undefined,
        subjectHints,
        tenant,
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
