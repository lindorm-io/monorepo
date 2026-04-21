import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { PylonSocketAuth } from "../../../types";
import {
  PYLON_AUTH_REFRESH_EVENT,
  registerAuthRefreshListener,
} from "./register-auth-refresh-listener";
import { describe, expect, test, vi } from "vitest";

const makeSocket = (auth?: PylonSocketAuth): any => {
  const handlers: Record<string, Function> = {};
  return {
    on: vi.fn((event: string, handler: Function) => {
      handlers[event] = handler;
    }),
    disconnect: vi.fn(),
    handlers,
    data: {
      pylon: auth ? { auth } : {},
    },
  };
};

describe("registerAuthRefreshListener", () => {
  test("does not subscribe when no auth state present", () => {
    const socket = makeSocket();
    registerAuthRefreshListener(socket, createMockLogger());
    expect(socket.on).not.toHaveBeenCalled();
  });

  test("subscribes to $pylon/auth/refresh when auth state present", () => {
    const auth: PylonSocketAuth = {
      strategy: "bearer",
      getExpiresAt: () => new Date(),
      refresh: vi.fn(async () => {}),
      authExpiredEmittedAt: null,
    };
    const socket = makeSocket(auth);

    registerAuthRefreshListener(socket, createMockLogger());

    expect(socket.on).toHaveBeenCalledWith(
      PYLON_AUTH_REFRESH_EVENT,
      expect.any(Function),
    );
  });

  test("delegates to auth.refresh and acks success", async () => {
    const refresh = vi.fn(async () => {});
    const auth: PylonSocketAuth = {
      strategy: "bearer",
      getExpiresAt: () => new Date(),
      refresh,
      authExpiredEmittedAt: null,
    };
    const socket = makeSocket(auth);
    registerAuthRefreshListener(socket, createMockLogger());

    const ack = vi.fn();
    const handler = socket.handlers[PYLON_AUTH_REFRESH_EVENT];

    await handler({ bearer: "new-jwt" }, ack);

    expect(refresh).toHaveBeenCalledWith({ bearer: "new-jwt" });
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({ __pylon: true, ok: true }),
    );
  });

  test("acks failure when auth.refresh throws", async () => {
    const refresh = vi.fn(async () => {
      const err: any = new Error("bad signature");
      err.status = 401;
      throw err;
    });
    const auth: PylonSocketAuth = {
      strategy: "bearer",
      getExpiresAt: () => new Date(),
      refresh,
      authExpiredEmittedAt: null,
    };
    const socket = makeSocket(auth);
    registerAuthRefreshListener(socket, createMockLogger());

    const ack = vi.fn();
    const handler = socket.handlers[PYLON_AUTH_REFRESH_EVENT];

    await handler({ bearer: "bad" }, ack);

    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({ __pylon: true, ok: false }),
    );
    const payload = ack.mock.calls[0][0];
    expect(payload.error).toMatchSnapshot();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  test("disconnects socket after failed session refresh", async () => {
    const refresh = vi.fn(async () => {
      throw new Error("session revoked");
    });
    const auth: PylonSocketAuth = {
      strategy: "session",
      getExpiresAt: () => new Date(),
      refresh,
      authExpiredEmittedAt: null,
    };
    const socket = makeSocket(auth);
    registerAuthRefreshListener(socket, createMockLogger());

    const ack = vi.fn();
    const handler = socket.handlers[PYLON_AUTH_REFRESH_EVENT];

    await handler({}, ack);

    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({ __pylon: true, ok: false }),
    );
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  test("does NOT disconnect socket after failed bearer refresh", async () => {
    const refresh = vi.fn(async () => {
      throw new Error("token expired");
    });
    const auth: PylonSocketAuth = {
      strategy: "bearer",
      getExpiresAt: () => new Date(),
      refresh,
      authExpiredEmittedAt: null,
    };
    const socket = makeSocket(auth);
    registerAuthRefreshListener(socket, createMockLogger());

    const ack = vi.fn();
    const handler = socket.handlers[PYLON_AUTH_REFRESH_EVENT];

    await handler({}, ack);

    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({ __pylon: true, ok: false }),
    );
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  test("tolerates missing ack (fire-and-forget)", async () => {
    const refresh = vi.fn(async () => {});
    const auth: PylonSocketAuth = {
      strategy: "bearer",
      getExpiresAt: () => new Date(),
      refresh,
      authExpiredEmittedAt: null,
    };
    const socket = makeSocket(auth);
    registerAuthRefreshListener(socket, createMockLogger());

    const handler = socket.handlers[PYLON_AUTH_REFRESH_EVENT];
    await handler({ bearer: "jwt" });

    expect(refresh).toHaveBeenCalled();
  });
});
