import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { AUDIT_SOURCE } from "#internal/constants/symbols";
import { useAuditLog } from "./use-audit-log";

jest.mock("#internal/utils/is-context");

import { isHttpContext, isSocketContext } from "#internal/utils/is-context";

describe("useAuditLog", () => {
  let ctx: any;
  let next: jest.Mock;
  let mockPublisher: any;
  let mockIris: any;
  let auditConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPublisher = {
      create: jest.fn().mockReturnValue({ id: "msg-1" }),
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockIris = {
      session: jest.fn().mockReturnValue({
        publisher: jest.fn().mockReturnValue(mockPublisher),
      }),
    };

    auditConfig = {
      iris: mockIris,
      actor: jest.fn().mockReturnValue("user-123"),
    };

    (isHttpContext as unknown as jest.Mock).mockReturnValue(true);
    (isSocketContext as unknown as jest.Mock).mockReturnValue(false);

    ctx = {
      logger: createMockLogger(),
      data: { foo: "bar" },
      request: { path: "/api/users", method: "POST", ip: "10.0.0.1" },
      status: 201,
      get: jest.fn().mockReturnValue("Mozilla/5.0"),
      state: {
        app: { name: "test-app" },
        metadata: {
          id: "req-1",
          correlationId: "cor-1",
          sessionId: "sess-1",
        },
      },
      [AUDIT_SOURCE]: auditConfig,
    };

    next = jest.fn().mockResolvedValue(undefined);
  });

  test("should call next before publishing", async () => {
    let nextCalledBeforePublish = false;

    next.mockImplementation(async () => {
      nextCalledBeforePublish = !mockPublisher.publish.mock.calls.length;
    });

    await useAuditLog()(ctx, next);

    expect(nextCalledBeforePublish).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should publish audit message with correct fields for HTTP", async () => {
    await useAuditLog()(ctx, next);

    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-1",
        correlationId: "cor-1",
        actor: "user-123",
        appName: "test-app",
        endpoint: "/api/users",
        method: "POST",
        transport: "http",
        statusCode: 201,
        duration: expect.any(Number),
        sourceIp: "10.0.0.1",
        requestBody: { foo: "bar" },
        sessionId: "sess-1",
        userAgent: "Mozilla/5.0",
      }),
    );
    expect(mockPublisher.publish).toHaveBeenCalledWith({ id: "msg-1" });
  });

  test("should publish audit message with correct fields for socket", async () => {
    (isHttpContext as unknown as jest.Mock).mockReturnValue(false);
    (isSocketContext as unknown as jest.Mock).mockReturnValue(true);

    ctx = {
      ...ctx,
      event: "chat:message",
      io: { socket: { handshake: { address: "192.168.1.1" } } },
    };
    delete ctx.request;
    delete ctx.status;
    delete ctx.get;

    await useAuditLog()(ctx, next);

    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "chat:message",
        method: "event",
        transport: "socket",
        statusCode: 200,
        sourceIp: "192.168.1.1",
        userAgent: null,
      }),
    );
  });

  test("should use per-route sanitise over global", async () => {
    const globalSanitise = jest.fn().mockReturnValue({ redacted: true });
    const routeSanitise = jest.fn().mockReturnValue({ route_redacted: true });

    auditConfig.sanitise = globalSanitise;

    await useAuditLog({ sanitise: routeSanitise })(ctx, next);

    expect(routeSanitise).toHaveBeenCalledWith({ foo: "bar" });
    expect(globalSanitise).not.toHaveBeenCalled();
    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: { route_redacted: true },
      }),
    );
  });

  test("should use global sanitise when no per-route sanitise", async () => {
    const globalSanitise = jest.fn().mockReturnValue({ global_redacted: true });
    auditConfig.sanitise = globalSanitise;

    await useAuditLog()(ctx, next);

    expect(globalSanitise).toHaveBeenCalledWith({ foo: "bar" });
    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: { global_redacted: true },
      }),
    );
  });

  test("should skip when skip returns true", async () => {
    const skip = jest.fn().mockReturnValue(true);

    await useAuditLog({ skip })(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockPublisher.create).not.toHaveBeenCalled();
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  test("should use global skip from config when no per-route skip", async () => {
    auditConfig.skip = jest.fn().mockReturnValue(true);

    await useAuditLog()(ctx, next);

    expect(auditConfig.skip).toHaveBeenCalledWith(ctx);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockPublisher.create).not.toHaveBeenCalled();
  });

  test("should not block response on publish failure", async () => {
    mockPublisher.publish.mockRejectedValue(new Error("publish failed"));

    await useAuditLog()(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should throw ServerError when audit not configured", async () => {
    delete ctx[AUDIT_SOURCE];

    await expect(useAuditLog()(ctx, next)).rejects.toThrow(ServerError);
    expect(next).not.toHaveBeenCalled();
  });

  test("should call next even when audit creation fails", async () => {
    auditConfig.actor = jest.fn().mockImplementation(() => {
      throw new Error("actor failed");
    });

    await useAuditLog()(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockPublisher.create).not.toHaveBeenCalled();
  });

  test("should pass null requestBody when ctx.data is falsy", async () => {
    ctx.data = null;

    await useAuditLog()(ctx, next);

    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: null,
      }),
    );
  });

  test("should handle missing sessionId gracefully", async () => {
    ctx.state.metadata.sessionId = undefined;

    await useAuditLog()(ctx, next);

    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: null,
      }),
    );
  });
});
