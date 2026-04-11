import { createMockLogger } from "@lindorm/logger";
import { PylonSocketAuth } from "../../../types";
import {
  PYLON_AUTH_REFRESH_EVENT,
  registerAuthRefreshListener,
} from "./register-auth-refresh-listener";

const makeSocket = (auth?: PylonSocketAuth): any => {
  const handlers: Record<string, Function> = {};
  return {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handler;
    }),
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
      refresh: jest.fn(async () => {}),
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
    const refresh = jest.fn(async () => {});
    const auth: PylonSocketAuth = {
      strategy: "bearer",
      getExpiresAt: () => new Date(),
      refresh,
      authExpiredEmittedAt: null,
    };
    const socket = makeSocket(auth);
    registerAuthRefreshListener(socket, createMockLogger());

    const ack = jest.fn();
    const handler = socket.handlers[PYLON_AUTH_REFRESH_EVENT];

    await handler({ bearer: "new-jwt" }, ack);

    expect(refresh).toHaveBeenCalledWith({ bearer: "new-jwt" });
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({ __pylon: true, ok: true }),
    );
  });

  test("acks failure when auth.refresh throws", async () => {
    const refresh = jest.fn(async () => {
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

    const ack = jest.fn();
    const handler = socket.handlers[PYLON_AUTH_REFRESH_EVENT];

    await handler({ bearer: "bad" }, ack);

    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({ __pylon: true, ok: false }),
    );
    const payload = ack.mock.calls[0][0];
    expect(payload.error).toMatchSnapshot();
  });

  test("tolerates missing ack (fire-and-forget)", async () => {
    const refresh = jest.fn(async () => {});
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
