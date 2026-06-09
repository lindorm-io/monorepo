import type { Socket } from "socket.io-client";
import { ZephyrError } from "../errors/ZephyrError.js";
import type { ZephyrAuthStrategy } from "./zephyr-auth-strategy.js";

const DEFAULT_REFRESH_ACK_TIMEOUT_MS = 5000;

const REFRESH_EVENT = "$pylon/auth/refresh";

export type CookieAuthStrategyOptions = {
  refreshUrl: string;
  refreshFetchInit?: RequestInit;
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

type ManagerWithCredentials = {
  opts?: { withCredentials?: boolean };
};

const enableWithCredentials = (socket: Socket): void => {
  const manager = (socket as unknown as { io: ManagerWithCredentials }).io;
  const opts = (manager.opts ??= {});
  opts.withCredentials = true;
};

const readResponseBodySafely = async (
  response: Response,
): Promise<string | undefined> => {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
};

export const createCookieAuthStrategy = (
  options: CookieAuthStrategyOptions,
): ZephyrAuthStrategy => {
  const timeoutMs = options.refreshAckTimeoutMs ?? DEFAULT_REFRESH_ACK_TIMEOUT_MS;

  const prepareHandshake = async (socket: Socket): Promise<void> => {
    enableWithCredentials(socket);
  };

  const refresh = async (socket: Socket): Promise<void> => {
    let response: Response;

    try {
      response = await fetch(options.refreshUrl, {
        method: "POST",
        credentials: "include",
        ...options.refreshFetchInit,
      });
    } catch (err) {
      throw new ZephyrError("Cookie refresh fetch failed to reach server", {
        code: "cookie_refresh_unreachable",
        title: "Cookie Refresh Unreachable",
        details:
          "The fetch to the cookie refresh URL never reached the server; check the refreshUrl, network connectivity, and CORS configuration.",
        data: { refreshUrl: options.refreshUrl },
        error: err instanceof Error ? err : undefined,
      });
    }

    if (!response.ok) {
      const body = await readResponseBodySafely(response);
      throw new ZephyrError("Cookie refresh fetch returned non-ok response", {
        code: "cookie_refresh_non_ok_response",
        title: "Cookie Refresh Non OK Response",
        details:
          "The cookie refresh endpoint responded with a non-2xx status; the session cookie was likely rejected or expired. Inspect debug.body for the server's response.",
        status: response.status,
        data: { refreshUrl: options.refreshUrl, status: response.status },
        debug: { body },
      });
    }

    let ack: unknown;

    try {
      ack = await socket.timeout(timeoutMs).emitWithAck(REFRESH_EVENT, {});
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
        "The server rejected the auth refresh after the cookie was refreshed; the session may still be invalid. Inspect debug.serverError for the server's reason.",
      debug: { serverError: error },
    });
  };

  return { prepareHandshake, refresh };
};
