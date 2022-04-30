import { BearerAuthContext, CustomValidation } from "../types";
import { ClientError } from "@lindorm-io/errors";
import { Middleware } from "@lindorm-io/koa";
import { get, isFunction } from "lodash";

interface MiddlewareOptions {
  clockTolerance?: number;
  contextKey?: string;
  issuer: string;
  maxAge?: string;
  subjectHint?: string;
  types?: Array<string>;
}

export interface BearerAuthOptions {
  audience?: string;
  audiences?: Array<string>;
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
  (middlewareOptions: MiddlewareOptions) =>
  (
    options: BearerAuthOptions = {},
    customValidation?: CustomValidation,
  ): Middleware<BearerAuthContext> =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("auth");

    const {
      clockTolerance,
      contextKey = "bearerToken",
      issuer,
      maxAge,
      subjectHint,
      types,
    } = middlewareOptions;
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
        audience: fromPath?.audience ? get(ctx, fromPath.audience) : audience,
        audiences: fromPath?.audiences ? get(ctx, fromPath.audiences) : audiences,
        clockTolerance,
        issuer,
        maxAge,
        nonce: fromPath?.nonce ? get(ctx, fromPath.nonce) : nonce,
        permissions: fromPath?.permissions ? get(ctx, fromPath.permissions) : permissions,
        scopes: fromPath?.scopes ? get(ctx, fromPath.scopes) : scopes,
        subject: fromPath?.subject ? get(ctx, fromPath.subject) : subject,
        subjects: fromPath?.subjects ? get(ctx, fromPath.subjects) : subjects,
        subjectHint,
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
        debug: { middlewareOptions, options },
        description: "Bearer Token is invalid",
        statusCode: ClientError.StatusCode.UNAUTHORIZED,
      });
    } finally {
      metric.end();
    }

    await next();
  };
