import { VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { get } from "object-path";
import { PylonSocketContext, PylonSocketMiddleware } from "../../types";

type Options = Omit<VerifyJwtOptions, "issuer"> & {
  contextKey: string;
  issuer: string;
};

export const socketTokenMiddleware =
  <C extends PylonSocketContext = PylonSocketContext>(options: Options) =>
  (path: string, optional: boolean = false): PylonSocketMiddleware<C> =>
    async function socketTokenMiddleware(ctx, next): Promise<void> {
      const start = Date.now();

      try {
        const token = get(ctx, path);

        ctx.logger.debug("Token found on path", { token, path });

        if (!isString(token) && !optional) {
          throw new ClientError("Token must be of type JWT", {
            status: ClientError.Status.Unauthorized,
          });
        }

        if (token) {
          const verified = await ctx.aegis.jwt.verify(token, options);

          ctx.logger.debug("Token verified", { verified });

          ctx.logger.info("Token verification successful", {
            subject: verified.payload.subject,
            subjectHint: verified.payload.subjectHint,
            tokenType: verified.payload.tokenType,
            time: Date.now() - start,
          });

          ctx.socket.data.tokens[options.contextKey] = verified;
        }
      } catch (error: any) {
        ctx.logger.debug("Token verification failed", {
          error,
          time: Date.now() - start,
        });

        throw new ClientError(error.message, {
          error,
          status: ClientError.Status.Unauthorized,
        });
      }

      await next();
    };
