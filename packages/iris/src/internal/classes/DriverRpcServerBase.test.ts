import type { Constructor } from "@lindorm/types";
import { Default } from "../../decorators/Default";
import { Field } from "../../decorators/Field";
import { IdentifierField } from "../../decorators/IdentifierField";
import { Message } from "../../decorators/Message";
import { IrisDriverError } from "../../errors/IrisDriverError";
import type { IMessage } from "../../interfaces";
import { clearRegistry } from "../message/metadata/registry";
import { prepareOutbound } from "../message/utils/prepare-outbound";
import { getMessageMetadata } from "../message/metadata/get-message-metadata";
import {
  DriverRpcServerBase,
  type DriverRpcServerBaseOptions,
} from "./DriverRpcServerBase";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Test message classes ---

@Message({ name: "RpcServerTestRequest" })
class RpcServerTestRequest {
  @IdentifierField()
  id!: string;

  @Field("string")
  query!: string;
}

@Message({ name: "RpcServerTestResponse" })
class RpcServerTestResponse {
  @IdentifierField()
  id!: string;

  @Field("string")
  answer!: string;

  @Default(0)
  @Field("integer")
  code!: number;
}

// --- Concrete test subclass ---

class TestRpcServer<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcServerBase<Req, Res> {
  public doServeSpy = vi.fn();
  public doUnserveSpy = vi.fn();

  public constructor(options: DriverRpcServerBaseOptions<Req, Res>) {
    super(options, "TestRpcServer");
  }

  protected async doServe(
    _queue: string,
    _topic: string,
    _handler: (request: Req) => Promise<Res>,
  ): Promise<void> {
    this.doServeSpy(_queue, _topic, _handler);
  }

  public async unserve(options?: { queue?: string }): Promise<void> {
    const topic = this.getDefaultQueue();
    const queue = options?.queue ?? topic;
    this.doUnserveSpy(queue);
    this.registeredQueues.delete(queue);
  }

  public async unserveAll(): Promise<void> {
    for (const queue of this.registeredQueues) {
      this.doUnserveSpy(queue);
    }
    this.registeredQueues.clear();
  }

  // Expose protected methods for testing
  public testGetDefaultQueue() {
    return this.getDefaultQueue();
  }

  public testProcessRequest(
    handler: (request: Req) => Promise<Res>,
    payload: Buffer,
    headers: Record<string, string>,
    queue: string,
  ) {
    return this.processRequest(handler, payload, headers, queue);
  }

  public testBuildErrorEnvelope(
    queue: string,
    error: Error,
    correlationId: string | null,
  ) {
    return this.buildErrorEnvelope(queue, error, correlationId);
  }

  public getRegisteredQueues() {
    return this.registeredQueues;
  }
}

// --- Helpers ---

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createServer = (): TestRpcServer<RpcServerTestRequest, RpcServerTestResponse> =>
  new TestRpcServer({
    requestTarget: RpcServerTestRequest as unknown as Constructor<RpcServerTestRequest>,
    responseTarget:
      RpcServerTestResponse as unknown as Constructor<RpcServerTestResponse>,
    logger: createMockLogger() as any,
  });

// --- Tests ---

describe("DriverRpcServerBase", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("serve", () => {
    it("should call doServe with queue, topic, and handler", async () => {
      const server = createServer();
      const handler = vi.fn();

      await server.serve(handler);

      expect(server.doServeSpy).toHaveBeenCalledTimes(1);
      expect(server.doServeSpy).toHaveBeenCalledWith(
        "RpcServerTestRequest",
        "RpcServerTestRequest",
        handler,
      );
    });

    it("should track the queue in registeredQueues", async () => {
      const server = createServer();

      await server.serve(vi.fn());

      expect(server.getRegisteredQueues().has("RpcServerTestRequest")).toBe(true);
      expect(server.getRegisteredQueues().size).toBe(1);
    });

    it("should use custom queue name when provided", async () => {
      const server = createServer();
      const handler = vi.fn();

      await server.serve(handler, { queue: "custom-queue" });

      expect(server.doServeSpy).toHaveBeenCalledWith(
        "custom-queue",
        "RpcServerTestRequest",
        handler,
      );
      expect(server.getRegisteredQueues().has("custom-queue")).toBe(true);
    });

    it("should throw IrisDriverError when registering the same queue twice", async () => {
      const server = createServer();

      await server.serve(vi.fn());

      await expect(server.serve(vi.fn())).rejects.toThrow(IrisDriverError);
      await expect(server.serve(vi.fn())).rejects.toThrow(/already registered for queue/);
    });

    it("should allow different queues on the same server", async () => {
      const server = createServer();

      await server.serve(vi.fn(), { queue: "queue-a" });
      await server.serve(vi.fn(), { queue: "queue-b" });

      expect(server.getRegisteredQueues().size).toBe(2);
    });
  });

  describe("getDefaultQueue", () => {
    it("should return the topic from request metadata", () => {
      const server = createServer();

      expect(server.testGetDefaultQueue()).toBe("RpcServerTestRequest");
    });
  });

  describe("processRequest", () => {
    it("should deserialize request, call handler, and return response envelope", async () => {
      const server = createServer();

      // Prepare a valid request payload
      const requestMetadata = getMessageMetadata(
        RpcServerTestRequest as unknown as Constructor<RpcServerTestRequest>,
      );
      const requestManager = (server as any).requestManager;
      const req = requestManager.create({ query: "hello" });
      const outbound = await prepareOutbound(req, requestMetadata);

      // Handler that creates a proper response
      const responseManager = (server as any).responseManager;
      const handler = vi.fn(async (_request: RpcServerTestRequest) => {
        return responseManager.create({ answer: "world", code: 200 });
      });

      const result = await server.testProcessRequest(
        handler,
        outbound.payload,
        outbound.headers,
        "test-queue",
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty("responseEnvelope");
      expect(Buffer.isBuffer(result.responseEnvelope.payload)).toBe(true);
      expect(result.responseEnvelope.topic).toBe("test-queue");
    });

    it("should pass the hydrated request to the handler", async () => {
      const server = createServer();

      const requestMetadata = getMessageMetadata(
        RpcServerTestRequest as unknown as Constructor<RpcServerTestRequest>,
      );
      const requestManager = (server as any).requestManager;
      const req = requestManager.create({ query: "specific-query" });
      const outbound = await prepareOutbound(req, requestMetadata);

      const responseManager = (server as any).responseManager;
      const handler = vi.fn(async (request: RpcServerTestRequest) => {
        expect(request.query).toBe("specific-query");
        return responseManager.create({ answer: "reply" });
      });

      await server.testProcessRequest(
        handler,
        outbound.payload,
        outbound.headers,
        "test-queue",
      );

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should propagate handler errors", async () => {
      const server = createServer();

      const requestMetadata = getMessageMetadata(
        RpcServerTestRequest as unknown as Constructor<RpcServerTestRequest>,
      );
      const requestManager = (server as any).requestManager;
      const req = requestManager.create({ query: "fail" });
      const outbound = await prepareOutbound(req, requestMetadata);

      const handler = vi.fn(async () => {
        throw new Error("Handler failed badly");
      });

      await expect(
        server.testProcessRequest(
          handler,
          outbound.payload,
          outbound.headers,
          "test-queue",
        ),
      ).rejects.toThrow("Handler failed badly");
    });

    it("should throw on invalid request payload", async () => {
      const server = createServer();

      const handler = vi.fn();

      await expect(
        server.testProcessRequest(
          handler,
          Buffer.from("invalid{{{"),
          { "x-iris-content-type": "application/json" },
          "test-queue",
        ),
      ).rejects.toThrow();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("buildErrorEnvelope", () => {
    it("should create an envelope with error headers", () => {
      const server = createServer();
      const error = new Error("Something went wrong");

      const envelope = server.testBuildErrorEnvelope("reply-queue", error, "corr-123");

      expect(envelope.headers["x-iris-rpc-error"]).toBe("true");
      expect(envelope.headers["x-iris-rpc-error-message"]).toBe("Something went wrong");
      expect(envelope.topic).toBe("reply-queue");
      expect(envelope.correlationId).toBe("corr-123");
    });

    it("should include the error message in the payload", () => {
      const server = createServer();
      const error = new Error("Payload error");

      const envelope = server.testBuildErrorEnvelope("queue", error, null);
      const parsed = JSON.parse(envelope.payload.toString("utf-8"));

      expect(parsed).toMatchSnapshot();
    });

    it("should handle null correlationId", () => {
      const server = createServer();
      const error = new Error("No correlation");

      const envelope = server.testBuildErrorEnvelope("queue", error, null);

      expect(envelope.correlationId).toBeNull();
    });

    it("should produce a well-structured envelope", () => {
      const server = createServer();
      const error = new Error("Structured test");

      const envelope = server.testBuildErrorEnvelope("my-queue", error, "corr-abc");

      // Snapshot the stable parts (exclude timestamp which varies)
      const { timestamp, payload, ...stable } = envelope;
      expect(stable).toMatchSnapshot();
    });
  });

  describe("unserve", () => {
    it("should call doUnserve and remove the queue from registeredQueues", async () => {
      const server = createServer();
      await server.serve(vi.fn());

      expect(server.getRegisteredQueues().size).toBe(1);

      await server.unserve();

      expect(server.doUnserveSpy).toHaveBeenCalledWith("RpcServerTestRequest");
      expect(server.getRegisteredQueues().size).toBe(0);
    });

    it("should unserve a specific queue by name", async () => {
      const server = createServer();
      await server.serve(vi.fn(), { queue: "custom-q" });

      await server.unserve({ queue: "custom-q" });

      expect(server.doUnserveSpy).toHaveBeenCalledWith("custom-q");
      expect(server.getRegisteredQueues().size).toBe(0);
    });
  });

  describe("unserveAll", () => {
    it("should unserve all registered queues", async () => {
      const server = createServer();
      await server.serve(vi.fn(), { queue: "q1" });
      await server.serve(vi.fn(), { queue: "q2" });
      await server.serve(vi.fn(), { queue: "q3" });

      expect(server.getRegisteredQueues().size).toBe(3);

      await server.unserveAll();

      expect(server.doUnserveSpy).toHaveBeenCalledTimes(3);
      expect(server.getRegisteredQueues().size).toBe(0);
    });

    it("should be safe to call with no registered queues", async () => {
      const server = createServer();

      await expect(server.unserveAll()).resolves.toBeUndefined();
      expect(server.getRegisteredQueues().size).toBe(0);
    });
  });
});
