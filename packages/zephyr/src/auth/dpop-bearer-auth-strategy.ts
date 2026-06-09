import type { Socket } from "socket.io-client";
import { ZephyrError } from "../errors/ZephyrError.js";
import { resolveHandshakeHtu } from "../internal/utils/resolve-handshake-htu.js";
import { signDpopProof } from "../internal/utils/sign-dpop-proof.js";
import type { BearerCredentials } from "./bearer-auth-strategy.js";
import type { ZephyrAuthStrategy } from "./zephyr-auth-strategy.js";

const DEFAULT_REFRESH_ACK_TIMEOUT_MS = 5000;

const REFRESH_EVENT = "$pylon/auth/refresh";

const DPOP_HEADER = "DPoP";

const HANDSHAKE_METHOD = "GET";

export type DpopBearerAuthStrategyOptions = {
  getBearerCredentials: () => BearerCredentials | Promise<BearerCredentials>;
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
  refreshAckTimeoutMs?: number;
};

type RefreshAckOk = { __pylon: true; ok: true };

type RefreshAckError = {
  __pylon: true;
  ok: false;
  error?: {
    code?: string | number;
    message?: string;
    status?: number;
    title?: string;
    data?: Record<string, unknown>;
  };
};

type RefreshAck = RefreshAckOk | RefreshAckError;

const isPylonAck = (value: unknown): value is RefreshAck =>
  typeof value === "object" &&
  value !== null &&
  (value as { __pylon?: unknown }).__pylon === true;

type ManagerWithHeaders = {
  opts?: { extraHeaders?: Record<string, string> };
};

const injectDpopHeader = (socket: Socket, proof: string): void => {
  const manager = (socket as unknown as { io: ManagerWithHeaders }).io;
  const opts = (manager.opts ??= {});
  opts.extraHeaders = {
    ...(opts.extraHeaders ?? {}),
    [DPOP_HEADER]: proof,
  };
};

export const createDpopBearerAuthStrategy = (
  options: DpopBearerAuthStrategyOptions,
): ZephyrAuthStrategy => {
  const timeoutMs = options.refreshAckTimeoutMs ?? DEFAULT_REFRESH_ACK_TIMEOUT_MS;

  const prepareHandshake = async (socket: Socket): Promise<void> => {
    const { bearer } = await options.getBearerCredentials();
    socket.auth = { bearer };

    const htu = resolveHandshakeHtu(socket);

    const proof = await signDpopProof({
      privateKey: options.privateKey,
      publicJwk: options.publicJwk,
      htm: HANDSHAKE_METHOD,
      htu,
      accessToken: bearer,
    });

    injectDpopHeader(socket, proof);
  };

  const refresh = async (socket: Socket): Promise<void> => {
    const { bearer, expiresIn } = await options.getBearerCredentials();

    if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new ZephyrError("Invalid expiresIn for auth refresh", {
        code: "auth_refresh_invalid_expires_in",
        title: "Auth Refresh Invalid Expires In",
        details:
          "The credentials provider returned an expiresIn that is not a positive finite number, so the access token lifetime cannot be scheduled.",
        data: { expiresIn },
      });
    }

    let ack: unknown;

    try {
      ack = await socket
        .timeout(timeoutMs)
        .emitWithAck(REFRESH_EVENT, { bearer, expiresIn });
    } catch (err) {
      throw new ZephyrError("Auth refresh ack timed out", {
        code: "auth_refresh_ack_timeout",
        title: "Auth Refresh Ack Timeout",
        details:
          "The server did not acknowledge the auth refresh emit within the configured timeout; the connection may be slow or the server is not handling the refresh event.",
        data: { timeoutMs },
        error: err instanceof Error ? err : undefined,
      });
    }

    if (!isPylonAck(ack)) {
      throw new ZephyrError("Auth refresh returned unrecognised ack", {
        code: "auth_refresh_unrecognised_ack",
        title: "Auth Refresh Unrecognised Ack",
        details:
          "The auth refresh acknowledgement was not a recognised pylon envelope; the server may be running an incompatible version or a different handler answered the event.",
        data: { ackType: typeof ack },
        debug: { ack },
      });
    }

    if (ack.ok) return;

    const error = ack.error ?? {};

    throw new ZephyrError(error.message ?? "Auth refresh rejected", {
      code: "auth_refresh_rejected",
      status: error.status,
      title: "Auth Refresh Rejected",
      details:
        "The server rejected the auth refresh; the supplied bearer credentials were likely invalid or expired. Inspect debug.serverError for the server's reason.",
      debug: { serverError: error },
    });
  };

  return { prepareHandshake, refresh };
};
