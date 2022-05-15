import { DefaultLindormMiddleware } from "../../types";
import { RedirectError } from "@lindorm-io/errors";
import { get } from "lodash";
import { isURL } from "../../util/private";

export interface RedirectErrorMiddlewareOptions {
  redirectUri: string;
  path?: string;
}

export const redirectErrorMiddleware =
  (options: RedirectErrorMiddlewareOptions): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    try {
      await next();
    } catch (err: any) {
      const redirectOnPath = options.path ? get(ctx, options.path) : null;
      const redirectUri = isURL(redirectOnPath) ? redirectOnPath : options.redirectUri;

      if (isURL(redirectUri)) {
        throw new RedirectError(err.message, {
          code: err.code || err.data.code || "unexpected_error",
          description: err.description || err.data.description,
          error: err,
          redirect: redirectUri,
          uri: err.uri || err.data.uri,
          state: err.state || err.data.state,
        });
      }

      throw err;
    }
  };
