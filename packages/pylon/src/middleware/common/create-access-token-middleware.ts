import { assertDpopHttpRequestMatch } from "#internal/utils/dpop/assert-dpop-http-request-match";
import { DEFAULT_AUTH_WARNING_MS } from "#internal/constants/auth";
import { isInExpiryWarningWindow } from "#internal/utils/auth-state/is-in-expiry-warning-window";
import { isTokenExpired } from "#internal/utils/auth-state/is-token-expired";
import { markAuthExpiredEmitted } from "#internal/utils/auth-state/mark-auth-expired-emitted";
import { shouldEmitAuthExpired } from "#internal/utils/auth-state/should-emit-auth-expired";
import {
  isHttpContext,
  isSocketEventContext,
  isSocketHandshakeContext,
} from "#internal/utils/is-context";
import { extractTokenFromSession } from "#internal/utils/tokens/extract-token-from-session";
import { resolveHttpTokenSource } from "#internal/utils/tokens/resolve-http-token-source";
import { VerifyJwtOptions } from "@lindorm/aegis";
import { ClientError, ServerError } from "@lindorm/errors";
import { PylonContext, PylonHttpContext, PylonMiddleware } from "../../types";

type Options = Omit<VerifyJwtOptions, "issuer"> & {
  issuer: string;
};

const runHttp = async (ctx: PylonHttpContext, options: Options): Promise<void> => {
  const source = resolveHttpTokenSource(ctx);

  if (source.kind === "bearer" || source.kind === "dpop") {
    const dpopProof =
      source.kind === "dpop"
        ? ((ctx.get("dpop") as string | undefined) ?? undefined)
        : undefined;

    if (source.kind === "dpop" && (!dpopProof || dpopProof.length === 0)) {
      throw new ClientError("Missing DPoP header", {
        details: "DPoP scheme requires a DPoP header on the request",
        status: ClientError.Status.Unauthorized,
      });
    }

    const verified = await ctx.aegis.verify(source.token, {
      tokenType: "access_token",
      ...options,
      dpopProof,
    });

    if (verified.dpop) {
      assertDpopHttpRequestMatch(ctx, verified.dpop);
    }

    ctx.state.tokens.accessToken = verified;
    return;
  }

  if (source.kind === "session") {
    const parsed = extractTokenFromSession(source.session);
    if (!parsed) {
      throw new ClientError("Invalid session access token", {
        status: ClientError.Status.Unauthorized,
      });
    }
    ctx.state.tokens.accessToken = parsed;
    return;
  }

  throw new ClientError("Invalid credentials", {
    details: "No authorization header or session available",
    status: ClientError.Status.Unauthorized,
  });
};

export const createAccessTokenMiddleware = <C extends PylonContext = PylonContext>(
  options: Options,
): PylonMiddleware<C> =>
  async function accessTokenMiddleware(ctx, next): Promise<void> {
    const timer = ctx.logger.time();

    try {
      if (isSocketHandshakeContext(ctx as any)) {
        throw new ServerError(
          "createAccessTokenMiddleware cannot run in handshake phase — use createHandshakeTokenMiddleware",
        );
      }

      if (isSocketEventContext(ctx as any)) {
        const socket = (ctx as any).io.socket;
        const auth = socket.data?.pylon?.auth;

        if (!auth) {
          throw new ClientError("Invalid credentials", {
            details:
              "No handshake auth state — install createHandshakeTokenMiddleware in socket.connectionMiddleware",
            status: ClientError.Status.Unauthorized,
          });
        }

        const expiresAt = auth.getExpiresAt();
        const now = new Date();

        if (isTokenExpired(expiresAt, now)) {
          throw new ClientError("Access token expired", {
            status: ClientError.Status.Unauthorized,
          });
        }

        if (
          isInExpiryWarningWindow(expiresAt, now, DEFAULT_AUTH_WARNING_MS) &&
          shouldEmitAuthExpired(auth, now)
        ) {
          socket.emit("$pylon/auth/expired", { expiresAt });
          markAuthExpiredEmitted(auth, now);
        }

        (ctx as any).state.tokens.accessToken = socket.data.tokens.bearer;
        timer.debug("Access token fast-path accepted", {
          expiresAt,
          strategy: auth.strategy,
        });
      } else if (isHttpContext(ctx as any)) {
        await runHttp(ctx as unknown as PylonHttpContext, options);
        timer.debug("Access token verified (http)");
      } else {
        throw new ClientError("Unsupported context for access token middleware", {
          status: ClientError.Status.Unauthorized,
        });
      }

      const verified = (ctx as any).state.tokens.accessToken;
      ctx.logger.info("Access token verification successful", {
        subject: verified?.payload?.subject,
        subjectHint: verified?.payload?.subjectHint,
        tokenType: verified?.header?.tokenType,
      });
    } catch (error: any) {
      timer.debug("Access token verification failed", error);

      if (error instanceof ClientError || error instanceof ServerError) {
        throw error;
      }

      throw new ClientError("Invalid credentials", {
        error,
        status: ClientError.Status.Unauthorized,
      });
    }

    await next();
  };
