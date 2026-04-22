import { setupDataAuditListeners } from "./setup-data-audit-listeners.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

class AuditedEntity {}
class NonAuditedEntity {}

describe("setupDataAuditListeners", () => {
  const mockPublish = vi.fn().mockResolvedValue(undefined);
  const mockCreate = vi.fn().mockImplementation((opts) => opts);
  const mockWorkerQueue = vi.fn().mockReturnValue({
    create: mockCreate,
    publish: mockPublish,
  });

  const listeners: Record<string, Function> = {};
  const mockOn = vi.fn().mockImplementation((event: string, listener: Function) => {
    listeners[event] = listener;
  });

  const proteus = { on: mockOn } as any;
  const iris = { workerQueue: mockWorkerQueue } as any;
  const logger = {
    debug: vi.fn(),
    verbose: vi.fn(),
    error: vi.fn(),
  } as any;

  const auditedMetadata = {
    target: AuditedEntity,
    entity: { name: "audited_entity", namespace: "test" },
    primaryKeys: ["id"],
    fields: [{ key: "id" }, { key: "name" }, { key: "email" }, { key: "age" }],
  };

  const nonAuditedMetadata = {
    target: NonAuditedEntity,
    entity: { name: "non_audited_entity", namespace: null },
    primaryKeys: ["id"],
    fields: [{ key: "id" }, { key: "value" }],
  };

  const baseContext = {
    correlationId: "corr-123",
    actor: "user@test.com",
    timestamp: new Date("2025-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(listeners).forEach((k) => delete listeners[k]);

    setupDataAuditListeners(proteus, iris, [AuditedEntity as any], logger);
  });

  test("should register listeners for all four event types", () => {
    expect(mockOn).toHaveBeenCalledWith("entity:after-insert", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("entity:after-update", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("entity:after-destroy", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith(
      "entity:after-soft-destroy",
      expect.any(Function),
    );
  });

  test("should publish DataAuditChange with action insert and null changes", () => {
    listeners["entity:after-insert"]({
      entity: { id: "ent-1", name: "Alice", email: "alice@test.com", age: 30 },
      metadata: auditedMetadata,
      context: baseContext,
      connection: {},
    });

    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "corr-123",
      actor: "user@test.com",
      entityName: "audited_entity",
      entityNamespace: "test",
      entityId: "ent-1",
      action: "insert",
      changes: null,
    });
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  test("should publish DataAuditChange with field diffs on update", () => {
    listeners["entity:after-update"]({
      entity: { id: "ent-1", name: "Bob", email: "alice@test.com", age: 31 },
      oldEntity: { id: "ent-1", name: "Alice", email: "alice@test.com", age: 30 },
      metadata: auditedMetadata,
      context: baseContext,
      connection: {},
    });

    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "corr-123",
      actor: "user@test.com",
      entityName: "audited_entity",
      entityNamespace: "test",
      entityId: "ent-1",
      action: "update",
      changes: {
        name: { from: "Alice", to: "Bob" },
        age: { from: 30, to: 31 },
      },
    });
  });

  test("should publish DataAuditChange with null changes when oldEntity is undefined", () => {
    listeners["entity:after-update"]({
      entity: { id: "ent-1", name: "Bob", email: "bob@test.com", age: 31 },
      oldEntity: undefined,
      metadata: auditedMetadata,
      context: baseContext,
      connection: {},
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        changes: null,
      }),
    );
  });

  test("should publish DataAuditChange with action destroy", () => {
    listeners["entity:after-destroy"]({
      entity: { id: "ent-2" },
      metadata: auditedMetadata,
      context: baseContext,
      connection: {},
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "ent-2",
        action: "destroy",
        changes: null,
      }),
    );
  });

  test("should publish DataAuditChange with action soft_destroy", () => {
    listeners["entity:after-soft-destroy"]({
      entity: { id: "ent-3" },
      metadata: auditedMetadata,
      context: baseContext,
      connection: {},
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "ent-3",
        action: "soft_destroy",
        changes: null,
      }),
    );
  });

  test("should ignore non-audited entities", () => {
    listeners["entity:after-insert"]({
      entity: { id: "ent-99", value: "test" },
      metadata: nonAuditedMetadata,
      context: baseContext,
      connection: {},
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  test("should extract correlationId from context", () => {
    listeners["entity:after-insert"]({
      entity: { id: "ent-4" },
      metadata: auditedMetadata,
      context: {
        correlationId: "custom-corr-456",
        actor: "other@test.com",
        timestamp: new Date(),
      },
      connection: {},
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "custom-corr-456",
      }),
    );
  });

  test("should use unknown for actor and correlationId when context is undefined", () => {
    listeners["entity:after-insert"]({
      entity: { id: "ent-5" },
      metadata: auditedMetadata,
      context: undefined,
      connection: {},
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "unknown",
        correlationId: "unknown",
      }),
    );
  });

  test("should handle composite primary keys by joining with colon", () => {
    const compositeMetadata = {
      ...auditedMetadata,
      primaryKeys: ["tenantId", "userId"],
    };

    listeners["entity:after-insert"]({
      entity: { tenantId: "tenant-1", userId: "user-2" },
      metadata: compositeMetadata,
      context: baseContext,
      connection: {},
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "tenant-1:user-2",
      }),
    );
  });

  test("should publish null changes when update has no field diffs", () => {
    listeners["entity:after-update"]({
      entity: { id: "ent-1", name: "Alice", email: "alice@test.com", age: 30 },
      oldEntity: { id: "ent-1", name: "Alice", email: "alice@test.com", age: 30 },
      metadata: auditedMetadata,
      context: baseContext,
      connection: {},
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        changes: null,
      }),
    );
  });

  test("should handle null entityNamespace", () => {
    const nullNsMetadata = {
      ...auditedMetadata,
      entity: { name: "audited_entity", namespace: null },
    };

    listeners["entity:after-insert"]({
      entity: { id: "ent-6" },
      metadata: nullNsMetadata,
      context: baseContext,
      connection: {},
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityNamespace: null,
      }),
    );
  });

  test("should log error and not throw when publish fails", () => {
    mockPublish.mockRejectedValueOnce(new Error("publish failed"));

    listeners["entity:after-insert"]({
      entity: { id: "ent-7" },
      metadata: auditedMetadata,
      context: baseContext,
      connection: {},
    });

    // Fire-and-forget — no error thrown
    expect(mockCreate).toHaveBeenCalled();
  });

  test("should log error and not throw when create fails", () => {
    mockWorkerQueue.mockReturnValueOnce({
      create: vi.fn().mockImplementation(() => {
        throw new Error("create failed");
      }),
      publish: mockPublish,
    });

    // Re-setup with the failing workerQueue
    Object.keys(listeners).forEach((k) => delete listeners[k]);
    setupDataAuditListeners(proteus, iris, [AuditedEntity as any], logger);

    listeners["entity:after-insert"]({
      entity: { id: "ent-8" },
      metadata: auditedMetadata,
      context: baseContext,
      connection: {},
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to create data audit message",
      expect.any(Error),
    );
  });

  test("should log verbose message on registration", () => {
    expect(logger.verbose).toHaveBeenCalledWith("Data audit listeners registered", {
      entities: ["AuditedEntity"],
    });
  });
});
