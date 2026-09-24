import { isSocketContext } from "../../internal/utils/is-context.js";
import { deploymentCritical } from "../../internal/utils/tokens/deployment-critical.js";
import { splitVerifyInput } from "../../internal/utils/tokens/split-verify-input.js";
import type { DomainAssert, VerifyOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { sanitiseToken } from "@lindorm/utils";
import objectPath from "object-path";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

// `critical` is omitted: the declaration is the DEPLOYMENT's
// (`PylonAuthSettings.critical`), never a mount's to widen.
type Options = Omit<DomainAssert & VerifyOptions, "issuer" | "critical"> & {
  contextKey: string;
  issuer: string;
};

export const createTokenMiddleware = <C extends PylonContext = PylonContext>(
  options: Options,
) => {
  // `contextKey` is a pylon routing key, not a verify input; the rest is the
  // matcher/knob bag routed to the reshaped `aegis.verify(token, assert, opts)`.
  const { contextKey: _contextKey, ...verifyInput } = options;
  const { assert, options: verifyOptions } = splitVerifyInput(
    verifyInput as DomainAssert & VerifyOptions,
  );

  return (path: string, optional: boolean = false): PylonMiddleware<C> =>
    async function tokenMiddleware(ctx, next): Promise<void> {
      const timer = ctx.logger.timer();

      try {
        const token = objectPath.get(ctx, path);

        ctx.logger.debug("Token found on path", { token: sanitiseToken(token), path });

        if (!isString(token) && !optional) {
          throw new ClientError("Expected a JWT string token on the request", {
            status: ClientError.Status.Unauthorized,
            code: "token_not_jwt",
            type: "urn:lindorm:pylon:error:token_not_jwt",
            title: "Token Not a JWT",
            details: `Expected a string token at path [${path}]`,
            data: { path },
            debug: { contextKey: options.contextKey, optional },
          });
        }

        if (token) {
          // The deployment's declaration is spread LAST, so an untyped or
          // cast-in bag cannot widen it — pinned: create-token-middleware.test.ts
          // "a route cannot widen the deployment's declaration".
          const verified = await ctx.aegis.verify(token, assert, {
            ...verifyOptions,
            critical: deploymentCritical(ctx.state.app.config.auth),
          });

          timer.debug("Token verified", { verified });

          ctx.logger.debug("Token verification successful", {
            subject: verified.claims.subject,
            subjectHint: verified.claims.subjectHint,
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
          title: "Token Verification Failed",
          details: error.message,
          data: { path },
          debug: { contextKey: options.contextKey, issuer: options.issuer },
        });
      }

      await next();
    };
};
