import type { Constructor } from "@lindorm/types";
import { Field } from "../../decorators/Field";
import { IdentifierField } from "../../decorators/IdentifierField";
import { Message } from "../../decorators/Message";
import { IrisTimeoutError } from "../../errors/IrisTimeoutError";
import { IrisTransportError } from "../../errors/IrisTransportError";
import type { IMessage } from "../../interfaces";
import { clearRegistry } from "../message/metadata/registry";
import { prepareOutbound } from "../message/utils/prepare-outbound";
import { getMessageMetadata } from "../message/metadata/get-message-metadata";
import {
  DriverRpcClientBase,
  type DriverRpcClientBaseOptions,
} from "./DriverRpcClientBase";

// --- Test message classes ---

@Message({ name: "RpcClientTestRequest" })
class RpcClientTestRequest {
  @IdentifierField()
  id!: string;

  @Field("string")
  query!: string;
}

@Message({ name: "RpcClientTestResponse" })
class RpcClientTestResponse {
  @IdentifierField()
  id!: string;

  @Field("string")
  answer!: string;

  @Field("integer", { default: 0 })
  code!: number;
}

// --- Concrete test subclass ---

class TestRpcClient<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcClientBase<Req, Res> {
  public doRequestSpy = jest.fn();
  public doCloseSpy = jest.fn();

  public constructor(options: DriverRpcClientBaseOptions<Req, Res>) {
    super(options, "TestRpcClient");
  }

  public async request(_message: Req, _options?: { timeout?: number }): Promise<Res> {
    this.doRequestSpy(_message, _options);
    return {} as Res;
  }

  public async close(): Promise<void> {
    this.doCloseSpy();
  }

  // Expose protected methods for testing
  public testPrepareRequestEnvelope(message: Req) {
    return this.prepareRequestEnvelope(message);
  }

  public testGetDefaultTimeout(options?: { timeout?: number }) {
    return this.getDefaultTimeout(options);
  }

  public testRegisterPendingRequest(
    correlationId: string,
    topic: string,
    timeoutMs: number,
    extraCleanup?: () => void,
  ) {
    return this.registerPendingRequest(correlationId, topic, timeoutMs, extraCleanup);
  }

  public testHandleReplyPayload(
    correlationId: string,
    payload: Buffer,
    headers: Record<string, string>,
  ) {
    return this.handleReplyPayload(correlationId, payload, headers);
  }

  public testRejectAllPending() {
    return this.rejectAllPending();
  }

  public getPendingRequests() {
    return this.pendingRequests;
  }

  public cleanupAllPending() {
    for (const [, pending] of this.pendingRequests) {
      pending.cleanup();
    }
    this.pendingRequests.clear();
  }
}

// --- Helpers ---

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const createClient = (): TestRpcClient<RpcClientTestRequest, RpcClientTestResponse> =>
  new TestRpcClient({
    requestTarget: RpcClientTestRequest as unknown as Constructor<RpcClientTestRequest>,
    responseTarget:
      RpcClientTestResponse as unknown as Constructor<RpcClientTestResponse>,
    logger: createMockLogger() as any,
  });

// --- Tests ---

describe("DriverRpcClientBase", () => {
  let activeClient: TestRpcClient<RpcClientTestRequest, RpcClientTestResponse> | null =
    null;

  beforeEach(() => {
    clearRegistry();
    jest.useFakeTimers();
    activeClient = null;
  });

  afterEach(() => {
    // Clean up any pending requests before restoring real timers to prevent
    // unhandled rejections from timers firing after the test ends
    if (activeClient) {
      activeClient.cleanupAllPending();
    }
    jest.useRealTimers();
  });

  describe("prepareRequestEnvelope", () => {
    it("should create a valid envelope with payload and headers", async () => {
      const client = createClient();
      const requestManager = (client as any).requestManager;
      const req = requestManager.create({ query: "hello" });

      const result = await client.testPrepareRequestEnvelope(req);

      expect(result).toHaveProperty("envelope");
      expect(result).toHaveProperty("topic");
      expect(Buffer.isBuffer(result.envelope.payload)).toBe(true);
      expect(typeof result.envelope.headers).toBe("object");
      expect(typeof result.topic).toBe("string");
    });

    it("should produce an envelope with default fields", async () => {
      const client = createClient();
      const requestManager = (client as any).requestManager;
      const req = requestManager.create({ query: "test" });

      const { envelope, topic } = await client.testPrepareRequestEnvelope(req);

      expect(topic).toBe("RpcClientTestRequest");
      expect(envelope.topic).toBe("RpcClientTestRequest");
      expect(envelope.priority).toBe(0);
      expect(envelope.broadcast).toBe(false);
      expect(envelope.replyTo).toBeNull();
      expect(envelope.correlationId).toBeNull();
    });

    it("should throw when given an invalid message", async () => {
      const client = createClient();
      const invalid = { id: 12345, query: "test" } as any;

      await expect(client.testPrepareRequestEnvelope(invalid)).rejects.toThrow();
    });
  });

  describe("getDefaultTimeout", () => {
    it("should return 30000 when no options provided", () => {
      const client = createClient();

      expect(client.testGetDefaultTimeout()).toBe(30_000);
    });

    it("should return 30000 when options are empty", () => {
      const client = createClient();

      expect(client.testGetDefaultTimeout({})).toBe(30_000);
    });

    it("should return the custom timeout when provided", () => {
      const client = createClient();

      expect(client.testGetDefaultTimeout({ timeout: 5000 })).toBe(5000);
    });

    it("should return 30000 when timeout is undefined", () => {
      const client = createClient();

      expect(client.testGetDefaultTimeout({ timeout: undefined })).toBe(30_000);
    });
  });

  describe("registerPendingRequest", () => {
    it("should store the pending request in the map", () => {
      activeClient = createClient();

      const { cleanup } = activeClient.testRegisterPendingRequest(
        "corr-1",
        "test-topic",
        5000,
      );

      expect(activeClient.getPendingRequests().size).toBe(1);
      expect(activeClient.getPendingRequests().has("corr-1")).toBe(true);

      cleanup();
    });

    it("should return a promise and cleanup function", () => {
      activeClient = createClient();

      const result = activeClient.testRegisterPendingRequest(
        "corr-2",
        "test-topic",
        5000,
      );

      expect(result).toHaveProperty("promise");
      expect(result).toHaveProperty("cleanup");
      expect(result.promise).toBeInstanceOf(Promise);
      expect(typeof result.cleanup).toBe("function");

      result.cleanup();
    });

    it("should remove the entry when cleanup is called", () => {
      const client = createClient();

      const { cleanup } = client.testRegisterPendingRequest("corr-3", "test-topic", 5000);

      expect(client.getPendingRequests().size).toBe(1);
      cleanup();
      expect(client.getPendingRequests().size).toBe(0);
    });

    it("should call extraCleanup when cleanup is invoked", () => {
      const client = createClient();
      const extraCleanup = jest.fn();

      const { cleanup } = client.testRegisterPendingRequest(
        "corr-4",
        "test-topic",
        5000,
        extraCleanup,
      );

      cleanup();

      expect(extraCleanup).toHaveBeenCalledTimes(1);
    });

    it("should reject with IrisTimeoutError when timeout expires", async () => {
      const client = createClient();

      const { promise } = client.testRegisterPendingRequest(
        "corr-timeout",
        "my-topic",
        2000,
      );

      jest.advanceTimersByTime(2000);

      await expect(promise).rejects.toThrow(IrisTimeoutError);
      await expect(promise).rejects.toThrow(/timed out after 2000ms/);
      await expect(promise).rejects.toThrow(/my-topic/);
    });

    it("should remove the entry from the map after timeout", async () => {
      const client = createClient();

      const { promise } = client.testRegisterPendingRequest(
        "corr-timeout-cleanup",
        "test-topic",
        1000,
      );

      jest.advanceTimersByTime(1000);

      await promise.catch(() => {});

      expect(client.getPendingRequests().size).toBe(0);
    });

    it("should call extraCleanup on timeout", async () => {
      const client = createClient();
      const extraCleanup = jest.fn();

      const { promise } = client.testRegisterPendingRequest(
        "corr-timeout-extra",
        "test-topic",
        1000,
        extraCleanup,
      );

      jest.advanceTimersByTime(1000);

      await promise.catch(() => {});

      expect(extraCleanup).toHaveBeenCalledTimes(1);
    });

    it("should support multiple concurrent pending requests", () => {
      activeClient = createClient();

      activeClient.testRegisterPendingRequest("corr-a", "topic-a", 5000);
      activeClient.testRegisterPendingRequest("corr-b", "topic-b", 5000);
      activeClient.testRegisterPendingRequest("corr-c", "topic-c", 5000);

      expect(activeClient.getPendingRequests().size).toBe(3);
    });
  });

  describe("handleReplyPayload", () => {
    it("should resolve the pending promise with a hydrated response", async () => {
      const client = createClient();

      const { promise } = client.testRegisterPendingRequest(
        "corr-reply",
        "test-topic",
        30000,
      );

      const responseMetadata = getMessageMetadata(
        RpcClientTestResponse as unknown as Constructor<RpcClientTestResponse>,
      );
      const responseManager = (client as any).responseManager;
      const res = responseManager.create({ answer: "world", code: 42 });
      const outbound = await prepareOutbound(res, responseMetadata);

      await client.testHandleReplyPayload(
        "corr-reply",
        outbound.payload,
        outbound.headers,
      );

      const resolved = await promise;
      expect(resolved.answer).toBe("world");
      expect(resolved.code).toBe(42);
    });

    it("should clean up the pending entry after resolving", async () => {
      const client = createClient();

      const { promise } = client.testRegisterPendingRequest(
        "corr-cleanup",
        "test-topic",
        30000,
      );

      const responseMetadata = getMessageMetadata(
        RpcClientTestResponse as unknown as Constructor<RpcClientTestResponse>,
      );
      const responseManager = (client as any).responseManager;
      const res = responseManager.create({ answer: "ok" });
      const outbound = await prepareOutbound(res, responseMetadata);

      await client.testHandleReplyPayload(
        "corr-cleanup",
        outbound.payload,
        outbound.headers,
      );

      await promise;
      expect(client.getPendingRequests().size).toBe(0);
    });

    it("should reject with error message when x-iris-rpc-error header is present", async () => {
      const client = createClient();

      const { promise } = client.testRegisterPendingRequest(
        "corr-error",
        "test-topic",
        30000,
      );

      await client.testHandleReplyPayload("corr-error", Buffer.alloc(0), {
        "x-iris-rpc-error": "true",
        "x-iris-rpc-error-message": "Handler blew up",
      });

      await expect(promise).rejects.toThrow("Handler blew up");
    });

    it("should reject with default message when x-iris-rpc-error header has no message", async () => {
      const client = createClient();

      const { promise } = client.testRegisterPendingRequest(
        "corr-error-default",
        "test-topic",
        30000,
      );

      await client.testHandleReplyPayload("corr-error-default", Buffer.alloc(0), {
        "x-iris-rpc-error": "true",
      });

      await expect(promise).rejects.toThrow("RPC handler error");
    });

    it("should reject when deserialization fails", async () => {
      const client = createClient();

      const { promise } = client.testRegisterPendingRequest(
        "corr-deser-fail",
        "test-topic",
        30000,
      );

      const invalidPayload = Buffer.from("not-valid-json{{{");

      await client.testHandleReplyPayload("corr-deser-fail", invalidPayload, {
        "x-iris-content-type": "application/json",
      });

      await expect(promise).rejects.toThrow();
    });

    it("should silently ignore unknown correlationId", async () => {
      const client = createClient();

      await expect(
        client.testHandleReplyPayload("unknown-corr", Buffer.alloc(0), {}),
      ).resolves.toBeUndefined();
    });

    it("should not resolve other pending requests when handling one reply", async () => {
      activeClient = createClient();

      activeClient.testRegisterPendingRequest("corr-other", "test-topic", 30000);
      const { promise: promise2 } = activeClient.testRegisterPendingRequest(
        "corr-target",
        "test-topic",
        30000,
      );

      const responseMetadata = getMessageMetadata(
        RpcClientTestResponse as unknown as Constructor<RpcClientTestResponse>,
      );
      const responseManager = (activeClient as any).responseManager;
      const res = responseManager.create({ answer: "targeted" });
      const outbound = await prepareOutbound(res, responseMetadata);

      await activeClient.testHandleReplyPayload(
        "corr-target",
        outbound.payload,
        outbound.headers,
      );

      const resolved = await promise2;
      expect(resolved.answer).toBe("targeted");

      // The other request should still be pending
      expect(activeClient.getPendingRequests().has("corr-other")).toBe(true);
      expect(activeClient.getPendingRequests().size).toBe(1);
    });
  });

  describe("rejectAllPending", () => {
    it("should reject all pending requests with IrisTransportError", async () => {
      const client = createClient();

      const { promise: p1 } = client.testRegisterPendingRequest(
        "corr-all-1",
        "topic",
        30000,
      );
      const { promise: p2 } = client.testRegisterPendingRequest(
        "corr-all-2",
        "topic",
        30000,
      );
      const { promise: p3 } = client.testRegisterPendingRequest(
        "corr-all-3",
        "topic",
        30000,
      );

      // Attach catch handlers before rejecting to prevent unhandled rejections
      const c1 = p1.catch(() => {});
      const c2 = p2.catch(() => {});
      const c3 = p3.catch(() => {});

      client.testRejectAllPending();

      await expect(p1).rejects.toThrow(IrisTransportError);
      await expect(p2).rejects.toThrow(IrisTransportError);
      await expect(p3).rejects.toThrow(IrisTransportError);

      await c1;
      await c2;
      await c3;
    });

    it("should reject with a message about client closure", async () => {
      const client = createClient();

      const { promise } = client.testRegisterPendingRequest("corr-close", "topic", 30000);

      const caught = promise.catch(() => {});

      client.testRejectAllPending();

      await expect(promise).rejects.toThrow(/closed while request was pending/);
      await caught;
    });

    it("should clear the pending map completely", async () => {
      const client = createClient();

      const { promise: p1 } = client.testRegisterPendingRequest(
        "corr-clear-1",
        "topic",
        30000,
      );
      const { promise: p2 } = client.testRegisterPendingRequest(
        "corr-clear-2",
        "topic",
        30000,
      );

      // Attach catch handlers before rejecting
      const c1 = p1.catch(() => {});
      const c2 = p2.catch(() => {});

      expect(client.getPendingRequests().size).toBe(2);

      client.testRejectAllPending();

      expect(client.getPendingRequests().size).toBe(0);

      await c1;
      await c2;
    });

    it("should be safe to call with no pending requests", () => {
      const client = createClient();

      expect(() => client.testRejectAllPending()).not.toThrow();
      expect(client.getPendingRequests().size).toBe(0);
    });
  });
});
