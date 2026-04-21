import type { IMessage } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { IrisTimeoutError } from "../../../../errors/IrisTimeoutError.js";
import { IrisTransportError } from "../../../../errors/IrisTransportError.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import { MemoryDriver } from "./MemoryDriver.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Test message classes ---

@Message({ name: "TckRpcReq" })
class TckRpcReq implements IMessage {
  @Field("string") question!: string;
}

@Message({ name: "TckRpcRes" })
class TckRpcRes implements IMessage {
  @Field("string") answer!: string;
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

const createRpcSetup = () => {
  const driver = new MemoryDriver({
    logger: createMockLogger() as any,
    getSubscribers: () => [],
  });
  const client = driver.createRpcClient(TckRpcReq, TckRpcRes);
  const server = driver.createRpcServer(TckRpcReq, TckRpcRes);
  return { driver, client, server };
};

// --- Tests ---

describe("MemoryRpcClient", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("request/response", () => {
    it("should send request and receive response", async () => {
      const { client, server } = createRpcSetup();

      await server.serve(async (req) => {
        const res = new TckRpcRes();
        res.answer = `answer to: ${req.question}`;
        return res;
      });

      const req = new TckRpcReq();
      req.question = "what is 2+2?";

      const response = await client.request(req);
      expect(response.answer).toBe("answer to: what is 2+2?");
    });

    it("should deserialize response correctly", async () => {
      const { client, server } = createRpcSetup();

      await server.serve(async () => {
        const res = new TckRpcRes();
        res.answer = "deserialized-value";
        return res;
      });

      const req = new TckRpcReq();
      req.question = "test";

      const response = await client.request(req);
      expect(response).toBeInstanceOf(TckRpcRes);
      expect(response.answer).toMatchSnapshot();
    });
  });

  describe("timeout", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should throw IrisTimeoutError when handler does not respond", async () => {
      const { client, server } = createRpcSetup();

      await server.serve(() => new Promise(() => {}));

      const req = new TckRpcReq();
      req.question = "timeout?";

      const promise = client.request(req, { timeout: 1000 });

      // Attach a no-op handler to prevent unhandled rejection during timer advance
      let caughtError: Error | undefined;
      promise.catch((err) => {
        caughtError = err;
      });

      // Flush microtasks so the async preamble in request() completes
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      await vi.advanceTimersByTimeAsync(1000);

      expect(caughtError).toBeInstanceOf(IrisTimeoutError);
    });

    it("should use custom timeout from options", async () => {
      const { client, server } = createRpcSetup();

      await server.serve(() => new Promise(() => {}));

      const req = new TckRpcReq();
      req.question = "custom-timeout";

      const promise = client.request(req, { timeout: 500 });

      let caughtError: Error | undefined;
      promise.catch((err) => {
        caughtError = err;
      });

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      await vi.advanceTimersByTimeAsync(500);

      expect(caughtError).toBeInstanceOf(IrisTimeoutError);
    });
  });

  describe("no handler registered", () => {
    it("should throw IrisTransportError", async () => {
      const { client } = createRpcSetup();

      const req = new TckRpcReq();
      req.question = "nobody home";

      await expect(client.request(req)).rejects.toThrow(IrisTransportError);
      await expect(client.request(req)).rejects.toThrow(
        /No RPC handler registered for queue/,
      );
    });
  });

  describe("handler error", () => {
    it("should reject with the handler error", async () => {
      const { client, server } = createRpcSetup();

      await server.serve(async () => {
        throw new Error("handler exploded");
      });

      const req = new TckRpcReq();
      req.question = "will-fail";

      await expect(client.request(req)).rejects.toThrow("handler exploded");
    });
  });

  describe("close", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should reject pending requests with IrisTransportError", async () => {
      const { client, server } = createRpcSetup();

      await server.serve(() => new Promise(() => {}));

      const req = new TckRpcReq();
      req.question = "will-be-closed";

      const promise = client.request(req, { timeout: 30_000 });

      // Yield enough microtasks for prepareRequestEnvelope + promise executor
      for (let i = 0; i < 10; i++) await Promise.resolve();

      await client.close();

      await expect(promise).rejects.toThrow(IrisTransportError);
    });

    it("should clean up timers on close", async () => {
      const { client, server, driver } = createRpcSetup();
      const store = (driver as any).store;

      await server.serve(() => new Promise(() => {}));

      const req = new TckRpcReq();
      req.question = "timer-cleanup";

      const promise = client.request(req, { timeout: 30_000 });
      promise.catch(() => {});

      // Yield enough microtasks for prepareRequestEnvelope + promise executor
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(store.timers.size).toBe(1);

      await client.close();

      expect(store.timers.size).toBe(0);
    });
  });

  describe("concurrent requests", () => {
    it("should handle two requests independently via correlationId", async () => {
      const { client, server } = createRpcSetup();

      await server.serve(async (req) => {
        const res = new TckRpcRes();
        res.answer = `reply:${req.question}`;
        return res;
      });

      const req1 = new TckRpcReq();
      req1.question = "first";

      const req2 = new TckRpcReq();
      req2.question = "second";

      const [res1, res2] = await Promise.all([
        client.request(req1),
        client.request(req2),
      ]);

      expect(res1.answer).toBe("reply:first");
      expect(res2.answer).toBe("reply:second");
    });
  });

  describe("base class integration", () => {
    it("should use base class pendingRequests map during inflight request", async () => {
      vi.useFakeTimers();

      const { client, server } = createRpcSetup();

      await server.serve(() => new Promise(() => {}));

      const req = new TckRpcReq();
      req.question = "inflight";

      const promise = client.request(req, { timeout: 30_000 });
      promise.catch(() => {});

      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect((client as any).pendingRequests.size).toBe(1);

      await client.close();

      expect((client as any).pendingRequests.size).toBe(0);

      vi.useRealTimers();
    });

    it("should clean up store.replyCallbacks after successful response", async () => {
      const { client, server, driver } = createRpcSetup();
      const store = (driver as any).store;

      await server.serve(async (req) => {
        const res = new TckRpcRes();
        res.answer = `done:${req.question}`;
        return res;
      });

      const req = new TckRpcReq();
      req.question = "cleanup-test";

      await client.request(req);

      expect(store.replyCallbacks.size).toBe(0);
      expect(store.pendingRejects.size).toBe(0);
    });

    it("should clean up store.replyCallbacks after timeout", async () => {
      vi.useFakeTimers();

      const { client, server, driver } = createRpcSetup();
      const store = (driver as any).store;

      await server.serve(() => new Promise(() => {}));

      const req = new TckRpcReq();
      req.question = "timeout-cleanup";

      const promise = client.request(req, { timeout: 500 });
      promise.catch(() => {});

      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(store.replyCallbacks.size).toBe(1);
      expect(store.pendingRejects.size).toBe(1);

      await vi.advanceTimersByTimeAsync(500);

      expect(store.replyCallbacks.size).toBe(0);
      expect(store.pendingRejects.size).toBe(0);

      vi.useRealTimers();
    });

    it("should clean up store.pendingRejects on close", async () => {
      vi.useFakeTimers();

      const { client, server, driver } = createRpcSetup();
      const store = (driver as any).store;

      await server.serve(() => new Promise(() => {}));

      const req = new TckRpcReq();
      req.question = "close-cleanup";

      const promise = client.request(req, { timeout: 30_000 });
      promise.catch(() => {});

      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(store.pendingRejects.size).toBe(1);

      await client.close();

      expect(store.pendingRejects.size).toBe(0);

      vi.useRealTimers();
    });
  });
});
