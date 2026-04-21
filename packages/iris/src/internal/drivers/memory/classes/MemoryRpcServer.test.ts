import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { clearRegistry } from "../../../message/metadata/registry";
import { MemoryDriver } from "./MemoryDriver";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Test message classes ---

@Message({ name: "TckRpcSrvReq" })
class TckRpcSrvReq implements IMessage {
  @Field("string") question!: string;
}

@Message({ name: "TckRpcSrvRes" })
class TckRpcSrvRes implements IMessage {
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

const createServerSetup = () => {
  const driver = new MemoryDriver({
    logger: createMockLogger() as any,
    getSubscribers: () => [],
  });
  const server = driver.createRpcServer(TckRpcSrvReq, TckRpcSrvRes);
  const store = (driver as any).store;
  return { driver, server, store };
};

// --- Tests ---

describe("MemoryRpcServer", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("serve", () => {
    it("should register handler in store with default queue from metadata", async () => {
      const { server, store } = createServerSetup();

      await server.serve(async () => {
        const res = new TckRpcSrvRes();
        res.answer = "test";
        return res;
      });

      expect(store.rpcHandlers).toHaveLength(1);
      expect(store.rpcHandlers[0].queue).toBe("TckRpcSrvReq");
    });

    it("should register handler with custom queue name", async () => {
      const { server, store } = createServerSetup();

      await server.serve(
        async () => {
          const res = new TckRpcSrvRes();
          res.answer = "test";
          return res;
        },
        { queue: "custom-queue" },
      );

      expect(store.rpcHandlers).toHaveLength(1);
      expect(store.rpcHandlers[0].queue).toBe("custom-queue");
    });

    it("should throw on duplicate registration for same queue", async () => {
      const { server } = createServerSetup();

      await server.serve(async () => {
        const res = new TckRpcSrvRes();
        res.answer = "first";
        return res;
      });

      await expect(
        server.serve(async () => {
          const res = new TckRpcSrvRes();
          res.answer = "second";
          return res;
        }),
      ).rejects.toThrow(IrisDriverError);

      await expect(
        server.serve(async () => {
          const res = new TckRpcSrvRes();
          res.answer = "second";
          return res;
        }),
      ).rejects.toThrow(/already registered/);
    });
  });

  describe("unserve", () => {
    it("should remove handler from store using default queue", async () => {
      const { server, store } = createServerSetup();

      await server.serve(async () => {
        const res = new TckRpcSrvRes();
        res.answer = "test";
        return res;
      });

      expect(store.rpcHandlers).toHaveLength(1);

      await server.unserve();

      expect(store.rpcHandlers).toHaveLength(0);
    });

    it("should remove handler from store using custom queue", async () => {
      const { server, store } = createServerSetup();

      await server.serve(
        async () => {
          const res = new TckRpcSrvRes();
          res.answer = "test";
          return res;
        },
        { queue: "custom-queue" },
      );

      expect(store.rpcHandlers).toHaveLength(1);

      await server.unserve({ queue: "custom-queue" });

      expect(store.rpcHandlers).toHaveLength(0);
    });

    it("should allow re-serving after unserve", async () => {
      const { server, store } = createServerSetup();

      await server.serve(async () => {
        const res = new TckRpcSrvRes();
        res.answer = "first";
        return res;
      });

      await server.unserve();

      await server.serve(async () => {
        const res = new TckRpcSrvRes();
        res.answer = "second";
        return res;
      });

      expect(store.rpcHandlers).toHaveLength(1);
    });
  });

  describe("error handling", () => {
    it("should return structured error envelope when handler throws", async () => {
      const { driver, server, store } = createServerSetup();

      await server.serve(async () => {
        throw new Error("handler-exploded");
      });

      const client = driver.createRpcClient(TckRpcSrvReq, TckRpcSrvRes);
      const req = new TckRpcSrvReq();
      req.question = "boom";

      await expect(client.request(req)).rejects.toThrow("handler-exploded");

      await server.unserveAll();
      await client.close();
    });

    it("should return structured error envelope when handler throws non-Error", async () => {
      const { driver, server } = createServerSetup();

      await server.serve(async () => {
        throw "string-error";
      });

      const client = driver.createRpcClient(TckRpcSrvReq, TckRpcSrvRes);
      const req = new TckRpcSrvReq();
      req.question = "boom";

      await expect(client.request(req)).rejects.toThrow("string-error");

      await server.unserveAll();
      await client.close();
    });

    it("should continue serving after a handler error", async () => {
      const { driver, server } = createServerSetup();
      let callCount = 0;

      await server.serve(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("first-call-fails");
        }
        const res = new TckRpcSrvRes();
        res.answer = "recovered";
        return res;
      });

      const client = driver.createRpcClient(TckRpcSrvReq, TckRpcSrvRes);

      const req1 = new TckRpcSrvReq();
      req1.question = "fail";
      await expect(client.request(req1)).rejects.toThrow("first-call-fails");

      const req2 = new TckRpcSrvReq();
      req2.question = "succeed";
      const response = await client.request(req2);
      expect(response.answer).toBe("recovered");

      await server.unserveAll();
      await client.close();
    });
  });

  describe("unserveAll", () => {
    it("should remove all handlers", async () => {
      const { server, store } = createServerSetup();

      await server.serve(
        async () => {
          const res = new TckRpcSrvRes();
          res.answer = "a";
          return res;
        },
        { queue: "queue-a" },
      );

      await server.serve(
        async () => {
          const res = new TckRpcSrvRes();
          res.answer = "b";
          return res;
        },
        { queue: "queue-b" },
      );

      expect(store.rpcHandlers).toHaveLength(2);

      await server.unserveAll();

      expect(store.rpcHandlers).toHaveLength(0);
    });
  });
});
