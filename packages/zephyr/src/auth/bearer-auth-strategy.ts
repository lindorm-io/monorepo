import type { Socket } from "socket.io-client";
import { ZephyrError } from "../errors/ZephyrError";
import type { ZephyrAuthStrategy } from "./zephyr-auth-strategy";

const DEFAULT_REFRESH_ACK_TIMEOUT_MS = 5000;

const REFRESH_EVENT = "$pylon/auth/refresh";

export type BearerAuthStrategyOptions = {
  getAccessToken: () => string | Promise<string>;
  getExpiresIn: () => number | Promise<number>;
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

export const createBearerAuthStrategy = (
  options: BearerAuthStrategyOptions,
): ZephyrAuthStrategy => {
  const timeoutMs = options.refreshAckTimeoutMs ?? DEFAULT_REFRESH_ACK_TIMEOUT_MS;

  const prepareHandshake = async (socket: Socket): Promise<void> => {
    const bearer = await options.getAccessToken();
    socket.auth = { bearer };
  };

  const refresh = async (socket: Socket): Promise<void> => {
    const [bearer, expiresIn] = await Promise.all([
      options.getAccessToken(),
      options.getExpiresIn(),
    ]);

    if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new ZephyrError("Invalid expiresIn for auth refresh", {
        code: "ZEPHYR_AUTH_REFRESH_INVALID_EXPIRES_IN",
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
