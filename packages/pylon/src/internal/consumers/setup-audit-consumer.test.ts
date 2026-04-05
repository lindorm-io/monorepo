import { setupAuditConsumer, AUDIT_QUEUE } from "./setup-audit-consumer";

describe("setupAuditConsumer", () => {
  const mockInsert = jest.fn().mockResolvedValue(undefined);
  const mockRepository = jest.fn().mockReturnValue({ insert: mockInsert });
  const mockConsume = jest.fn().mockResolvedValue(undefined);
  const mockWorkerQueue = jest.fn().mockReturnValue({ consume: mockConsume });

  const iris = { workerQueue: mockWorkerQueue } as any;
  const proteus = { repository: mockRepository } as any;
  const logger = {
    debug: jest.fn(),
    verbose: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should set up worker queue consumer for RequestAudit", async () => {
    await setupAuditConsumer(iris, proteus, logger);

    expect(mockWorkerQueue).toHaveBeenCalledTimes(1);
    expect(mockConsume).toHaveBeenCalledWith(AUDIT_QUEUE, expect.any(Function));
  });

  test("should persist audit log entity when message is consumed", async () => {
    await setupAuditConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      id: "msg-id-1",
      requestId: "req-id-1",
      correlationId: "corr-id-1",
      actor: "user@example.com",
      appName: "test-app",
      endpoint: "/api/test",
      method: "GET",
      transport: "http",
      statusCode: 200,
      duration: 42,
      sourceIp: "127.0.0.1",
      requestBody: { foo: "bar" },
      sessionId: "sess-id-1",
      userAgent: "TestAgent/1.0",
    });

    expect(mockRepository).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith({
      requestId: "req-id-1",
      correlationId: "corr-id-1",
      actor: "user@example.com",
      appName: "test-app",
      endpoint: "/api/test",
      method: "GET",
      transport: "http",
      statusCode: 200,
      duration: 42,
      sourceIp: "127.0.0.1",
      requestBody: { foo: "bar" },
      sessionId: "sess-id-1",
      userAgent: "TestAgent/1.0",
    });
  });

  test("should persist audit log with null optional fields", async () => {
    await setupAuditConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      id: "msg-id-2",
      requestId: "req-id-2",
      correlationId: "corr-id-2",
      actor: "anonymous",
      appName: "test-app",
      endpoint: "/api/health",
      method: "GET",
      transport: "http",
      statusCode: 200,
      duration: 5,
      sourceIp: "10.0.0.1",
      requestBody: null,
      sessionId: null,
      userAgent: null,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: null,
        sessionId: null,
        userAgent: null,
      }),
    );
  });
});
