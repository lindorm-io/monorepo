import { ClientError } from "@lindorm-io/errors";
import { get, isFunction } from "lodash";
import {
  BearerTokenCustomValidation,
  DefaultLindormBearerAuthKoaMiddleware,
  BearerAuthMiddlewareConfig,
} from "../types";

export interface BearerAuthOptions {
  adjustedAccessLevel?: number;
  audience?: string;
  audiences?: Array<string>;
  levelOfAssurance?: number;
  nonce?: string;
  permissions?: Array<string>;
  scopes?: Array<string>;
  subject?: string;
  subjects?: Array<string>;

  fromPath?: {
    audience?: string;
    audiences?: string;
    nonce?: string;
    permissions?: string;
    scopes?: string;
    subject?: string;
    subjects?: string;
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
      adjustedAccessLevel,
      clockTolerance,
      contextKey = "bearerToken",
      issuer,
      levelOfAssurance,
      maxAge,
      subjectHint,
      types,
    } = config;
    const { audience, audiences, nonce, permissions, scopes, subject, subjects, fromPath } =
      options;

    try {
      const { type: tokenType, value: token } = ctx.getAuthorizationHeader() || {};

      if (tokenType !== "Bearer") {
        throw new ClientError("Invalid Token Type", {
          debug: { tokenType, token },
        });
      }

      ctx.token[contextKey] = ctx.jwt.verify(token, {
        adjustedAccessLevel,
        audience: fromPath?.audience ? get(ctx, fromPath.audience) : audience,
        audiences: fromPath?.audiences ? get(ctx, fromPath.audiences) : audiences,
        clockTolerance,
        issuer,
        levelOfAssurance,
        maxAge,
        nonce: fromPath?.nonce ? get(ctx, fromPath.nonce) : nonce,
        permissions: fromPath?.permissions ? get(ctx, fromPath.permissions) : permissions,
        scopes: fromPath?.scopes ? get(ctx, fromPath.scopes) : scopes,
        subject: fromPath?.subject ? get(ctx, fromPath.subject) : subject,
        subjectHint,
        subjects: fromPath?.subjects ? get(ctx, fromPath.subjects) : subjects,
        types: types || ["access_token"],
      });

      if (isFunction(customValidation)) {
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
