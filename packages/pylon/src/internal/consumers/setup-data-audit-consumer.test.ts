import { setupDataAuditConsumer, DATA_AUDIT_QUEUE } from "./setup-data-audit-consumer";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("setupDataAuditConsumer", () => {
  const mockInsert = vi.fn().mockResolvedValue(undefined);
  const mockRepository = vi.fn().mockReturnValue({ insert: mockInsert });
  const mockConsume = vi.fn().mockResolvedValue(undefined);
  const mockWorkerQueue = vi.fn().mockReturnValue({ consume: mockConsume });

  const iris = { workerQueue: mockWorkerQueue } as any;
  const proteus = { repository: mockRepository } as any;
  const logger = {
    debug: vi.fn(),
    verbose: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should set up worker queue consumer for DataAuditChange", async () => {
    await setupDataAuditConsumer(iris, proteus, logger);

    expect(mockWorkerQueue).toHaveBeenCalledTimes(1);
    expect(mockConsume).toHaveBeenCalledWith(DATA_AUDIT_QUEUE, expect.any(Function));
  });

  test("should persist data audit log entity when message is consumed", async () => {
    await setupDataAuditConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      id: "msg-id-1",
      correlationId: "corr-id-1",
      actor: "user@test.com",
      entityName: "user_profile",
      entityNamespace: "app",
      entityId: "user-123",
      action: "update",
      changes: {
        name: { from: "Alice", to: "Bob" },
        age: { from: 30, to: 31 },
      },
    });

    expect(mockRepository).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith({
      correlationId: "corr-id-1",
      actor: "user@test.com",
      entityName: "user_profile",
      entityNamespace: "app",
      entityId: "user-123",
      action: "update",
      changes: {
        name: { from: "Alice", to: "Bob" },
        age: { from: 30, to: 31 },
      },
    });
  });

  test("should persist data audit log with null changes for insert", async () => {
    await setupDataAuditConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      id: "msg-id-2",
      correlationId: "corr-id-2",
      actor: "admin@test.com",
      entityName: "order",
      entityNamespace: null,
      entityId: "order-456",
      action: "insert",
      changes: null,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entityNamespace: null,
        action: "insert",
        changes: null,
      }),
    );
  });

  test("should log debug message after persisting", async () => {
    await setupDataAuditConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      id: "msg-id-3",
      correlationId: "corr-id-3",
      actor: "user@test.com",
      entityName: "product",
      entityNamespace: "shop",
      entityId: "prod-789",
      action: "destroy",
      changes: null,
    });

    expect(logger.debug).toHaveBeenCalledWith("Data audit log persisted", {
      entityName: "product",
      entityId: "prod-789",
      action: "destroy",
    });
  });

  test("should log verbose message on startup", async () => {
    await setupDataAuditConsumer(iris, proteus, logger);

    expect(logger.verbose).toHaveBeenCalledWith("Data audit consumer started", {
      queue: DATA_AUDIT_QUEUE,
    });
  });
});
