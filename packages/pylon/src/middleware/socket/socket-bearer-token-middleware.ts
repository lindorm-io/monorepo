import { VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { PylonSocketContext, PylonSocketMiddleware } from "../../types";

type Options = Omit<VerifyJwtOptions, "issuer"> & {
  issuer: string;
};

export const createSocketBearerTokenMiddleware = <
  C extends PylonSocketContext = PylonSocketContext,
>(
  options: Options,
): PylonSocketMiddleware<C> =>
  async function socketBearerTokenMiddleware(ctx, next): Promise<void> {
    const metric = ctx.metric("socketBearerTokenMiddleware");

    try {
      const token = ctx.socket.handshake.auth.bearer;

      ctx.logger.debug("Token found", { token });

      if (!isString(token)) {
        throw new ClientError("Token must be of type JWT", {
          status: ClientError.Status.Unauthorized,
        });
      }

      const verified = await ctx.aegis.verify(token, options);

      ctx.logger.debug("Token verified", { verified });

      ctx.logger.info("Token verification successful", {
        subject: verified.payload.subject,
        subjectHint: verified.payload.subjectHint,
        tokenType: verified.payload.tokenType,
      });

      ctx.socket.data.tokens.bearer = verified;
    } catch (error: any) {
      ctx.logger.debug("Token verification failed", error);

      throw new ClientError(error.message, {
        error,
        status: ClientError.Status.Unauthorized,
      });
    } finally {
      metric.end();
    }

    await next();
  };
