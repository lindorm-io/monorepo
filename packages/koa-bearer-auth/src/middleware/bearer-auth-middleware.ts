import { AdjustedAccessLevel, LevelOfAssurance } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { get } from "object-path";
import {
  BearerAuthMiddlewareConfig,
  BearerTokenCustomValidation,
  DefaultLindormBearerAuthKoaMiddleware,
} from "../types";

export type BearerAuthOptions = {
  adjustedAccessLevel?: AdjustedAccessLevel;
  levelOfAssurance?: LevelOfAssurance;
  maxAge?: string | number;
  scopes?: string[];

  fromPath?: {
    nonce?: string;
    subject?: string;
  };
};

export const bearerAuthMiddleware =
  (config: BearerAuthMiddlewareConfig) =>
  (
    options: BearerAuthOptions = {},
    customValidation?: BearerTokenCustomValidation,
  ): DefaultLindormBearerAuthKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("auth");

    const {
      audience,
      clockTolerance,
      contextKey = "bearerToken",
      issuer,
      subjectHints,
      tenant,
      types = ["access_token"],
    } = config;

    const { adjustedAccessLevel, levelOfAssurance, maxAge, scopes, fromPath = {} } = options;
    const { nonce, subject } = fromPath;

    try {
      const { type: tokenType, value: token } = ctx.getAuthorizationHeader() || {};

      if (tokenType !== "Bearer") {
        throw new ClientError("Invalid Token Type", {
          debug: { tokenType, token },
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

      ctx.logger.debug("bearer token validated", {
        [contextKey]: token,
      });
    } catch (err: any) {
      throw new ClientError("Invalid Authorization", {
        error: err,
        debug: { config, options },
        description: "Bearer Token is invalid",
        statusCode: ClientError.StatusCode.UNAUTHORIZED,
      });
    } finally {
      metric.end();
    }

    await next();
  };
