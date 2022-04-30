import { ClientError } from "@lindorm-io/errors";
import { CustomValidation, TokenIssuerContext } from "../types";
import { Middleware } from "@lindorm-io/koa";
import { get, isFunction, isString } from "lodash";

interface MiddlewareOptions {
  clockTolerance?: number;
  contextKey: string;
  issuer: string;
  maxAge?: string;
  subjectHint?: string;
  types: Array<string>;
}

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
  (middlewareOptions: MiddlewareOptions) =>
  (
    path: string,
    options: TokenValidationOptions = {},
    customValidation?: CustomValidation,
  ): Middleware<TokenIssuerContext> =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("token");

    const { clockTolerance, contextKey, issuer, maxAge, subjectHint, types } = middlewareOptions;
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
          debug: { middlewareOptions, options, path, token },
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
          debug: { middlewareOptions, options },
          description: `${contextKey} is invalid`,
          statusCode: ClientError.StatusCode.UNAUTHORIZED,
        });
      }
    } finally {
      metric.end();
    }

    await next();
  };
