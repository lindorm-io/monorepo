import { isSocketContext } from "#internal/utils/is-context";
import { VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { PylonContext, PylonMiddleware } from "../../types";

type Options = Omit<VerifyJwtOptions, "issuer"> & {
  issuer: string;
};

export const createBearerTokenMiddleware = <C extends PylonContext = PylonContext>(
  options: Options,
): PylonMiddleware<C> =>
  async function bearerTokenMiddleware(ctx, next): Promise<void> {
    const timer = ctx.logger.time();

    try {
      let token: unknown;

      if (isSocketContext(ctx)) {
        token = ctx.io.socket.handshake.auth.bearer;
      } else {
        if (ctx.state.authorization.type !== "bearer") {
          throw new ClientError("Invalid Authorization header", {
            details: "Authorization header must be of type Bearer",
            debug: { state: ctx.state.authorization },
            status: ClientError.Status.Unauthorized,
          });
        }
        token = ctx.state.authorization.value;
      }

      if (!isString(token)) {
        throw new ClientError("Token must be of type JWT", {
          status: ClientError.Status.Unauthorized,
        });
      }

      const verified = await ctx.aegis.verify(token, {
        tokenType: "access_token",
        ...options,
      });

      timer.debug("Token verified", { verified });

      ctx.logger.info("Bearer token verification successful", {
        subject: verified.payload.subject,
        subjectHint: verified.payload.subjectHint,
        tokenType: verified.payload.tokenType,
      });

      ctx.state.tokens.accessToken = verified;

      if (isSocketContext(ctx)) {
        ctx.io.socket.data.tokens.bearer = verified;
      }
    } catch (error: any) {
      timer.debug("Bearer token verification failed", error);

      throw new ClientError("Invalid credentials", {
        error,
        status: ClientError.Status.Unauthorized,
      });
    }

    await next();
  };
