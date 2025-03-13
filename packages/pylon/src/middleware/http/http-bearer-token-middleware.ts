import { VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { PylonHttpContext, PylonHttpMiddleware } from "../../types";

type Options = Omit<VerifyJwtOptions, "issuer"> & {
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
      const authorization = ctx.get("authorization");

      if (!authorization) {
        throw new ClientError("Authorization header is required", {
          status: ClientError.Status.Unauthorized,
        });
      }

      const [tokenType, token] = authorization.split(" ");

      ctx.logger.debug("Token found in Authorization header", { token, tokenType });

      if (tokenType !== "Bearer") {
        throw new ClientError("Authorization header must be of type Bearer", {
          status: ClientError.Status.Unauthorized,
        });
      }

      if (!isString(token)) {
        throw new ClientError("Authorization token must be of type JWT", {
          status: ClientError.Status.Unauthorized,
        });
      }

      const verified = await ctx.aegis.verify(token, options);

      ctx.logger.debug("Token verified", { verified });

      ctx.logger.info("Bearer token verification successful", {
        subject: verified.payload.subject,
        subjectHint: verified.payload.subjectHint,
        tokenType: verified.payload.tokenType,
        time: Date.now() - start,
      });

      ctx.tokens.bearer = verified;
    } catch (error: any) {
      ctx.logger.debug("Bearer token verification failed", {
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
