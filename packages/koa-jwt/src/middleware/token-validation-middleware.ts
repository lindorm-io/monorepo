import { ClientError } from "@lindorm-io/errors";
import {
  TokenCustomValidation,
  DefaultLindormJwtKoaMiddleware,
  TokenValidationMiddlewareConfig,
} from "../types";
import { get, isFunction, isString } from "lodash";

export interface TokenValidationOptions {
  audience?: string;
  audiences?: Array<string>;
  authorizedParty?: string;
  nonce?: string;
  permissions?: Array<string>;
  scopes?: Array<string>;
  subject?: string;
  subjects?: Array<string>;

  fromPath?: {
    audience?: string;
    audiences?: string;
    authorizedParty?: string;
    nonce?: string;
    permissions?: string;
    scopes?: string;
    subject?: string;
    subjects?: string;
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

    const { clockTolerance, contextKey, issuer, maxAge, subjectHint, types } = config;
    const {
      audience,
      audiences,
      authorizedParty,
      nonce,
      permissions,
      scopes,
      subject,
      subjects,
      fromPath,
    } = options;

    const token = get(ctx, path);

    try {
      if (!isString(token)) {
        throw new ClientError("Token not found", {
          debug: { middlewareOptions: config, options, path, token },
        });
      }

      ctx.token[contextKey] = ctx.jwt.verify(token, {
        audience: fromPath?.audience ? get(ctx, fromPath.audience) : audience,
        audiences: fromPath?.audiences ? get(ctx, fromPath.audiences) : audiences,
        authorizedParty: fromPath?.authorizedParty
          ? get(ctx, fromPath.authorizedParty)
          : authorizedParty,
        clockTolerance,
        issuer,
        maxAge,
        nonce: fromPath?.nonce ? get(ctx, fromPath.nonce) : nonce,
        permissions: fromPath?.permissions ? get(ctx, fromPath.permissions) : permissions,
        scopes: fromPath?.scopes ? get(ctx, fromPath.scopes) : scopes,
        subject: fromPath?.subject ? get(ctx, fromPath.subject) : subject,
        subjectHint,
        subjects: fromPath?.subjects ? get(ctx, fromPath.subjects) : subjects,
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
