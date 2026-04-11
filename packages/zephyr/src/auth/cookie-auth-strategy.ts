import type { Socket } from "socket.io-client";
import { ZephyrError } from "../errors/ZephyrError";
import type { ZephyrAuthStrategy } from "./zephyr-auth-strategy";

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
        code: "ZEPHYR_COOKIE_REFRESH_FETCH_ERROR",
        data: { refreshUrl: options.refreshUrl },
        error: err instanceof Error ? err : undefined,
      });
    }

    if (!response.ok) {
      const body = await readResponseBodySafely(response);
      throw new ZephyrError("Cookie refresh fetch returned non-ok response", {
        code: "ZEPHYR_COOKIE_REFRESH_FETCH_FAILED",
        status: response.status,
        data: { refreshUrl: options.refreshUrl, status: response.status, body },
      });
    }

    let ack: unknown;

    try {
      ack = await socket.timeout(timeoutMs).emitWithAck(REFRESH_EVENT, {});
    } catch (err) {
      throw new ZephyrError("Auth refresh ack timed out", {
        code: "ZEPHYR_AUTH_REFRESH_TIMEOUT",
        data: { timeoutMs },
        error: err instanceof Error ? err : undefined,
      });
    }

    if (!isPylonAck(ack)) {
      throw new ZephyrError("Auth refresh returned unrecognised ack", {
        code: "ZEPHYR_AUTH_REFRESH_INVALID_ACK",
        data: { ack: ack as Record<string, unknown> },
      });
    }

    if (ack.ok) return;

    const error = ack.error ?? {};

    throw new ZephyrError(error.message ?? "Auth refresh rejected", {
      code: error.code ?? "ZEPHYR_AUTH_REFRESH_REJECTED",
      status: error.status,
      title: error.title,
      data: error.data,
    });
  };

  return { prepareHandshake, refresh };
};
