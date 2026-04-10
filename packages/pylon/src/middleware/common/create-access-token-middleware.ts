import { assertDpopRequestMatch } from "#internal/utils/assert-dpop-request-match";
import { extractAccessTokenInput } from "#internal/utils/extract-access-token-input";
import { isHttpContext, isSocketContext } from "#internal/utils/is-context";
import { VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { PylonContext, PylonMiddleware } from "../../types";

type Options = Omit<VerifyJwtOptions, "issuer"> & {
  issuer: string;
};

export const createAccessTokenMiddleware = <C extends PylonContext = PylonContext>(
  options: Options,
): PylonMiddleware<C> =>
  async function accessTokenMiddleware(ctx, next): Promise<void> {
    const timer = ctx.logger.time();

    try {
      const { token, dpopProof } = extractAccessTokenInput(ctx);

      const verified = await ctx.aegis.verify(token, {
        tokenType: "access_token",
        ...options,
        dpopProof,
      });

      timer.debug("Token verified", { verified });

      if (verified.dpop && isHttpContext(ctx)) {
        assertDpopRequestMatch(ctx, verified.dpop);
      }

      ctx.logger.info("Access token verification successful", {
        subject: verified.payload.subject,
        subjectHint: verified.payload.subjectHint,
        tokenType: verified.header.tokenType,
      });

      ctx.state.tokens.accessToken = verified;

      if (isSocketContext(ctx)) {
        ctx.io.socket.data.tokens.bearer = verified;
      }
    } catch (error: any) {
      timer.debug("Access token verification failed", error);

      throw new ClientError("Invalid credentials", {
        error,
        status: ClientError.Status.Unauthorized,
      });
    }

    await next();
  };
