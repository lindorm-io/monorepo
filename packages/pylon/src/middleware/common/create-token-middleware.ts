import { isSocketContext } from "../../internal/utils/is-context.js";
import type { VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import objectPath from "object-path";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

type Options = Omit<VerifyJwtOptions, "issuer"> & {
  contextKey: string;
  issuer: string;
};

export const createTokenMiddleware =
  <C extends PylonContext = PylonContext>(options: Options) =>
  (path: string, optional: boolean = false): PylonMiddleware<C> =>
    async function tokenMiddleware(ctx, next): Promise<void> {
      const timer = ctx.logger.timer();

      try {
        const token = objectPath.get(ctx, path);

        ctx.logger.debug("Token found on path", { token, path });

        if (!isString(token) && !optional) {
          throw new ClientError("Expected a JWT string token on the request", {
            status: ClientError.Status.Unauthorized,
            code: "token_not_jwt",
            type: "urn:lindorm:pylon:error:token_not_jwt",
            details: `Expected a string token at path [${path}]`,
            data: { path },
            debug: { contextKey: options.contextKey, optional },
          });
        }

        if (token) {
          const verified = await ctx.aegis.jwt.verify(token, options);

          timer.debug("Token verified", { verified });

          ctx.logger.info("Token verification successful", {
            subject: verified.payload.subject,
            subjectHint: verified.payload.subjectHint,
            tokenType: verified.header.tokenType,
          });

          ctx.state.tokens[options.contextKey] = verified;

          if (isSocketContext(ctx)) {
            ctx.io.socket.data.tokens[options.contextKey] = verified;
          }
        }
      } catch (error: any) {
        timer.debug("Token verification failed", error);

        throw new ClientError("Token verification failed", {
          error,
          status: ClientError.Status.Unauthorized,
          code: "token_verification_failed",
          type: "urn:lindorm:pylon:error:token_verification_failed",
          details: error.message,
          data: { path },
          debug: { contextKey: options.contextKey, issuer: options.issuer },
        });
      }

      await next();
    };
