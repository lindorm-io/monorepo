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
          throw new ClientError("Token must be of type JWT", {
            status: ClientError.Status.Unauthorized,
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

        throw new ClientError(error.message, {
          error,
          status: ClientError.Status.Unauthorized,
        });
      }

      await next();
    };
