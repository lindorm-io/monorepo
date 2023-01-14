import { ClientError } from "@lindorm-io/errors";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { flatten, get, uniq } from "lodash";
import {
  BearerTokenCustomValidation,
  DefaultLindormBearerAuthKoaMiddleware,
  BearerAuthMiddlewareConfig,
} from "../types";

export interface BearerAuthOptions {
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
}

export const bearerAuthMiddleware =
  (config: BearerAuthMiddlewareConfig) =>
  (
    options: BearerAuthOptions = {},
    customValidation?: BearerTokenCustomValidation,
  ): DefaultLindormBearerAuthKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("auth");

    const {
      clockTolerance,
      contextKey = "bearerToken",
      issuer,
      subjectHint,
      types = ["access_token"],
    } = config;

    const { adjustedAccessLevel, fromPath, levelOfAssurance, maxAge, permissions, scopes } =
      options;

    const audiences = uniq(flatten([config.audiences || [], options.audiences || []]));

    try {
      const { type: tokenType, value: token } = ctx.getAuthorizationHeader() || {};

      if (tokenType !== "Bearer") {
        throw new ClientError("Invalid Token Type", {
          debug: { tokenType, token },
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
