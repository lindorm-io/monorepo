import { VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { AuthorizationType } from "../../enums";
import { PylonHttpContext, PylonHttpMiddleware } from "../../types";

type Options = Omit<VerifyJwtOptions, "issuer" | "tokenType"> & {
  issuer: string;
};

export const createHttpBearerTokenMiddleware = <
  C extends PylonHttpContext = PylonHttpContext,
>(
  options: Options,
): PylonHttpMiddleware<C> =>
  async function httpBearerTokenMiddleware(ctx, next): Promise<void> {
    const start = Date.now();

    try {
      if (ctx.state.authorization.type !== AuthorizationType.Bearer) {
        throw new ClientError("Invalid Authorization header", {
          details: "Authorization header must be of type Bearer",
          debug: {
            header: ctx.get("authorization"),
            state: ctx.state.authorization,
          },
          status: ClientError.Status.Unauthorized,
        });
      }

      const verified = await ctx.aegis.verify(ctx.state.authorization.value, {
        ...options,
        tokenType: "access_token",
      });

      ctx.logger.debug("Token verified", { verified });

      ctx.logger.info("Bearer token verification successful", {
        subject: verified.payload.subject,
        subjectHint: verified.payload.subjectHint,
        tokenType: verified.payload.tokenType,
        time: Date.now() - start,
      });

      ctx.state.tokens.accessToken = verified;
    } catch (error: any) {
      throw new ClientError("Invalid credentials", {
        error,
        debug: { token: ctx.state.authorization.value },
        status: ClientError.Status.Unauthorized,
      });
    }

    await next();
  };
