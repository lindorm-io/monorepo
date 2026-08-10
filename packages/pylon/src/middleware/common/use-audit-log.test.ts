import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintTestAccessToken,
} from "../../__fixtures__/access/aegis.js";
import { ACCESS_TEST_AUDIENCE } from "../../__fixtures__/access/tokens.js";
import { createTestAppConfig } from "../../__fixtures__/app-config.js";
import { useAuditLog } from "./use-audit-log.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../../internal/utils/is-context.js");

import { isHttpContext, isSocketContext } from "../../internal/utils/is-context.js";

const CLIENT_CONTEXT = {
  userAgent: {
    raw: "Mozilla/5.0",
    browser: null,
    os: null,
    deviceType: "unknown" as const,
  },
  app: { name: "MyApp", version: "1.2.3" },
  build: null,
  channel: null,
  device: null,
  platform: null,
  timezone: null,
};

describe("useAuditLog", () => {
  let ctx: any;
  let next: Mock;
  let mockPublisher: any;
  let auditConfig: any;

  /** Rebuild ctx.state.app.config.audit from the mutable `auditConfig` bag. */
  const applyAuditConfig = (): void => {
    ctx.state.app.config = createTestAppConfig({ audit: { ...auditConfig } });
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPublisher = {
      create: vi.fn().mockReturnValue({ id: "msg-1" }),
      publish: vi.fn().mockResolvedValue(undefined),
    };

    auditConfig = {};

    (isHttpContext as unknown as Mock).mockReturnValue(true);
    (isSocketContext as unknown as Mock).mockReturnValue(false);

    ctx = {
      // The request-scoped iris SESSION, exactly what the dependencies
      // middleware installs — audit no longer carries a source of its own.
      bus: { publisher: vi.fn().mockReturnValue(mockPublisher) },
      logger: createMockLogger(),
      data: { foo: "bar" },
      request: { path: "/api/users", method: "POST", ip: "10.0.0.1" },
      status: 201,
      get: vi.fn().mockReturnValue("Mozilla/5.0"),
      state: {
        access: null,
        actor: "user-123",
        app: {
          name: "test-app",
          config: createTestAppConfig({ audit: {} }),
        },
        authorization: { type: "none", value: null },
        client: CLIENT_CONTEXT,
        metadata: {
          id: "req-1",
          correlationId: "cor-1",
          sessionId: "sess-1",
        },
        tokens: {},
      },
    };

    next = vi.fn().mockResolvedValue(undefined);
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
        client: CLIENT_CONTEXT,
      }),
    );
    expect(mockPublisher.publish).toHaveBeenCalledWith({ id: "msg-1" });
  });

  test("should publish audit message with correct fields for socket", async () => {
    (isHttpContext as unknown as Mock).mockReturnValue(false);
    (isSocketContext as unknown as Mock).mockReturnValue(true);

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
        sessionId: null,
        client: CLIENT_CONTEXT,
      }),
    );
  });

  // Neither http nor socket: the audit still WRITES, with placeholder values —
  // it does not throw. Pinning that, because it is the arm no real transport
  // reaches and so the one a refactor can quietly change.
  test("should publish 'unknown' placeholders for a non-http, non-socket context", async () => {
    (isHttpContext as unknown as Mock).mockReturnValue(false);
    (isSocketContext as unknown as Mock).mockReturnValue(false);

    await useAuditLog()(ctx, next);

    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "unknown",
        method: "unknown",
        transport: "unknown",
        statusCode: 0,
        sourceIp: "unknown",
        sessionId: null,
      }),
    );
    expect(mockPublisher.publish).toHaveBeenCalledWith({ id: "msg-1" });
  });

  test("should use per-route sanitise over global", async () => {
    const globalSanitise = vi.fn().mockReturnValue({ redacted: true });
    const routeSanitise = vi.fn().mockReturnValue({ route_redacted: true });

    auditConfig.sanitise = globalSanitise;
    applyAuditConfig();

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
    const globalSanitise = vi.fn().mockReturnValue({ global_redacted: true });
    auditConfig.sanitise = globalSanitise;
    applyAuditConfig();

    await useAuditLog()(ctx, next);

    expect(globalSanitise).toHaveBeenCalledWith({ foo: "bar" });
    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: { global_redacted: true },
      }),
    );
  });

  test("should skip when skip returns true", async () => {
    const skip = vi.fn().mockReturnValue(true);

    await useAuditLog({ skip })(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockPublisher.create).not.toHaveBeenCalled();
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  test("should use global skip from config when no per-route skip", async () => {
    auditConfig.skip = vi.fn().mockReturnValue(true);
    applyAuditConfig();

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

  // ⚠ The ONE remaining throw, and it is the genuine one: audit is on and there
  // is nowhere to publish the record.
  test("should throw ServerError when audit is on with no bus", async () => {
    delete ctx.bus;

    await expect(useAuditLog()(ctx, next)).rejects.toThrow(ServerError);
    expect(next).not.toHaveBeenCalled();
  });

  // ⚠ `config.audit` is the WHOLE switch. Off means pass through even with no
  // bus at all — the two channels that could disagree are gone.
  test("should pass through silently (no throw) when audit is disabled by config", async () => {
    ctx.state.app.config = createTestAppConfig({ audit: false });
    delete ctx.bus; // disabled AND no bus — must not throw

    await expect(useAuditLog()(ctx, next)).resolves.not.toThrow();

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockPublisher.create).not.toHaveBeenCalled();
  });

  // The record inherits this request's actor and correlation id, because the
  // publisher comes from the request-scoped session rather than a bare one
  // opened off a stashed source.
  test("should publish through the request-scoped bus session", async () => {
    await useAuditLog()(ctx, next);

    expect(ctx.bus.publisher).toHaveBeenCalledTimes(1);
  });

  test("should call next even when audit creation fails", async () => {
    mockPublisher.create.mockImplementation(() => {
      throw new Error("create failed");
    });

    await useAuditLog()(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockPublisher.publish).not.toHaveBeenCalled();
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

  test("should fall back to 'unknown' actor when resolver finds no actor", async () => {
    ctx.state.actor = "unknown";
    ctx.state.tokens = {};
    ctx.state.authorization = { type: "none", value: null };

    await useAuditLog()(ctx, next);

    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "unknown" }),
    );
  });

  // ⚠ A REAL minted-and-verified token, not a `{ claims: { … } }` literal: the
  // audit record's `actor` is only worth anything if it survives aegis's
  // wire→domain claim translation, and a literal cannot prove that.
  //
  // Minted and verified under the `access_token` PROFILE (RFC 9068) — the only
  // shape `useAccessToken` puts on `ctx.state.tokens.accessToken`, so the token
  // the actor resolver is handed here is the one it is handed in production.
  test("should resolve actor from a real verified access token when ctx.state.actor is 'unknown'", async () => {
    const aegis = createTestAegis(createMockLogger());
    const token = await mintTestAccessToken(aegis, { subject: "bob" });
    const verified = await aegis.verify("access_token", token, undefined, {
      audience: ACCESS_TEST_AUDIENCE,
      issuer: ACCESS_TEST_ISSUER,
    });

    ctx.state.actor = "unknown";
    ctx.state.tokens = { accessToken: verified };
    ctx.state.authorization = { type: "none", value: null };

    await useAuditLog()(ctx, next);

    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "bob" }),
    );
  });

  // An introspected credential never lands in `ctx.state.tokens`, so this is the
  // request that used to be audited as "unknown" despite being authenticated.
  test("should resolve actor from an introspected credential on ctx.state.access", async () => {
    ctx.state.actor = "unknown";
    ctx.state.access = {
      provenance: "introspected",
      token: "opaque-token",
      claims: { subject: "carol" },
    };
    ctx.state.tokens = {};
    ctx.state.authorization = { type: "none", value: null };

    await useAuditLog()(ctx, next);

    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "carol" }),
    );
  });

  // ⭐ The record is written whether or not the chain throws. Everything below
  // used to produce NOTHING: the publish sat after a bare `await next()`, so a
  // 401 / 403 / 429 / 500 left no trace at all. The end-to-end proof — that the
  // status recorded is the one the client saw, through the error handler pylon
  // mounts above the route — is in `PylonHttp.audit.test.ts`.
  describe("a request that throws downstream", () => {
    test("should still publish an audit record", async () => {
      next.mockRejectedValue(new Error("downstream exploded"));

      await expect(useAuditLog()(ctx, next)).rejects.toThrow("downstream exploded");

      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
    });

    test("should rethrow the ORIGINAL error, unchanged", async () => {
      const original = new ClientError("Forbidden", {
        status: ClientError.Status.Forbidden,
        code: "insufficient_scope",
      });
      next.mockRejectedValue(original);

      await expect(useAuditLog()(ctx, next)).rejects.toBe(original);
    });

    // ⚠ A `finally` that throws REPLACES the in-flight exception. If recording
    // the audit could throw, the request would surface an audit-log failure
    // instead of what it actually failed with.
    test("should surface the original error even when the record cannot be built", async () => {
      const original = new Error("downstream exploded");
      next.mockRejectedValue(original);
      mockPublisher.create.mockImplementation(() => {
        throw new Error("create failed");
      });

      await expect(useAuditLog()(ctx, next)).rejects.toBe(original);
      expect(ctx.logger.error).toHaveBeenCalledWith(
        "Failed to create audit log",
        expect.any(Error),
      );
    });

    test("should record the status the error resolves to, not ctx.status", async () => {
      // What koa still has on the context when this frame unwinds — the error
      // handler sits ABOVE and has not run yet.
      ctx.status = 404;
      next.mockRejectedValue(
        new ClientError("Forbidden", {
          status: ClientError.Status.Forbidden,
          code: "insufficient_scope",
          type: "urn:lindorm:pylon:error:insufficient_scope",
        }),
      );

      await expect(useAuditLog()(ctx, next)).rejects.toThrow();

      expect(mockPublisher.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          errorCode: "insufficient_scope",
          errorType: "urn:lindorm:pylon:error:insufficient_scope",
        }),
      );
    });

    test("should record 500 and the fallback identifiers for a bare Error", async () => {
      next.mockRejectedValue(new Error("kaboom"));

      await expect(useAuditLog()(ctx, next)).rejects.toThrow();

      expect(mockPublisher.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          errorCode: "unknown_error",
          errorType: "urn:lindorm:error:unknown_error",
        }),
      );
    });

    // A socket event has no status of its own, so a COMPLETED one records 200 —
    // but a failed one must not be recorded as having succeeded.
    test("should record the error status on a socket event, not 200", async () => {
      (isHttpContext as unknown as Mock).mockReturnValue(false);
      (isSocketContext as unknown as Mock).mockReturnValue(true);

      ctx = {
        ...ctx,
        event: "chat:message",
        io: { socket: { handshake: { address: "192.168.1.1" } } },
      };
      next.mockRejectedValue(
        new ClientError("Nope", { status: ClientError.Status.Unauthorized }),
      );

      await expect(useAuditLog()(ctx, next)).rejects.toThrow();

      expect(mockPublisher.create).toHaveBeenCalledWith(
        expect.objectContaining({ transport: "socket", statusCode: 401 }),
      );
    });

    // The error's identity, never its prose. A message is interpolated at the
    // throw site and can carry request values `sanitise` never sees.
    test("should never put the error message or stack on the record", async () => {
      next.mockRejectedValue(new Error("user@example.com is not permitted"));

      await expect(useAuditLog()(ctx, next)).rejects.toThrow();

      const [record] = mockPublisher.create.mock.calls[0];
      expect(JSON.stringify(record)).not.toContain("user@example.com");
      expect(record).not.toHaveProperty("errorMessage");
      expect(record).not.toHaveProperty("errorStack");
    });

    // A skipped request is skipped whether it throws or not — the switch runs
    // before `next()` and owes the same answer on both paths.
    test("should not publish for a skipped request that throws", async () => {
      next.mockRejectedValue(new Error("downstream exploded"));

      await expect(useAuditLog({ skip: () => true })(ctx, next)).rejects.toThrow(
        "downstream exploded",
      );

      expect(mockPublisher.create).not.toHaveBeenCalled();
    });
  });

  test("should record errorCode and errorType as null for a request that did not throw", async () => {
    await useAuditLog()(ctx, next);

    expect(mockPublisher.create).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: null, errorType: null }),
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
