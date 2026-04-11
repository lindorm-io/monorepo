import { ILogger } from "@lindorm/logger";
import { PylonSocket } from "../../../types";

export const PYLON_AUTH_REFRESH_EVENT = "$pylon/auth/refresh";

export const registerAuthRefreshListener = (
  socket: PylonSocket,
  logger: ILogger,
): void => {
  if (!socket.data?.pylon?.auth) return;

  socket.on(PYLON_AUTH_REFRESH_EVENT, async (...args: Array<any>) => {
    const last = args[args.length - 1];
    const ack = typeof last === "function" ? last : undefined;
    const payload = ack ? args.slice(0, -1)[0] : args[0];

    try {
      const auth = socket.data?.pylon?.auth;
      if (!auth) {
        ack?.({
          __pylon: true,
          ok: false,
          error: { message: "No auth state", name: "Unauthorized" },
        });
        return;
      }

      await auth.refresh(payload);
      ack?.({ __pylon: true, ok: true, data: { refreshed: true } });
    } catch (err: any) {
      logger.warn("$pylon/auth/refresh failed", err);
      ack?.({
        __pylon: true,
        ok: false,
        error: {
          code: err.code ?? "refresh_failed",
          message: err.message ?? "Refresh failed",
          name: err.name ?? "Error",
          status: err.status ?? 401,
        },
      });
    }
  });
};
