// TCK: RPC Suite
// Tests request/response pattern with timeouts.
// Uses REAL timers for cross-driver portability.

import { IrisTimeoutError } from "../../../errors/IrisTimeoutError";
import { IrisError } from "../../../errors/IrisError";
import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { wait } from "./wait";

export const rpcSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  _timeoutMs: number,
) => {
  describe("rpc", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("should complete request-response roundtrip", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const server = handle.rpcServer(TckRpcRequest, TckRpcResponse);
      const client = handle.rpcClient(TckRpcRequest, TckRpcResponse);

      await server.serve(async (req) => {
        const res = new TckRpcResponse();
        res.answer = `answer-to-${req.question}`;
        return res;
      });

      await wait(500);

      const req = new TckRpcRequest();
      req.question = "meaning-of-life";

      const response = await client.request(req);

      expect(response.answer).toBe("answer-to-meaning-of-life");

      await server.unserveAll();
      await client.close();
    });

    test("should throw when no handler registered", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const client = handle.rpcClient(TckRpcRequest, TckRpcResponse);

      const req = new TckRpcRequest();
      req.question = "unhandled";

      await expect(client.request(req)).rejects.toThrow(IrisError);

      await client.close();
    });

    test("should timeout with IrisTimeoutError", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const server = handle.rpcServer(TckRpcRequest, TckRpcResponse);
      const client = handle.rpcClient(TckRpcRequest, TckRpcResponse);

      // Handler that never responds in time
      await server.serve(async () => {
        return new Promise<never>(() => {
          // intentionally never resolves
        });
      });

      await wait(500);

      const req = new TckRpcRequest();
      req.question = "slow";

      await expect(client.request(req, { timeout: 100 })).rejects.toThrow(
        IrisTimeoutError,
      );

      await server.unserveAll();
      await client.close();
    });

    test("should stop handling after unserve()", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const server = handle.rpcServer(TckRpcRequest, TckRpcResponse);
      const client = handle.rpcClient(TckRpcRequest, TckRpcResponse);

      await server.serve(async (req) => {
        const res = new TckRpcResponse();
        res.answer = `answer-to-${req.question}`;
        return res;
      });

      await wait(500);

      // Verify roundtrip works before unserve
      const req1 = new TckRpcRequest();
      req1.question = "first";

      const response = await client.request(req1);
      expect(response.answer).toBe("answer-to-first");

      // Unserve the default queue
      await server.unserve();

      // Second request should fail — no handler registered
      const req2 = new TckRpcRequest();
      req2.question = "second";

      await expect(client.request(req2)).rejects.toThrow(IrisError);

      await client.close();
    });

    test("should propagate handler errors to client", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const server = handle.rpcServer(TckRpcRequest, TckRpcResponse);
      const client = handle.rpcClient(TckRpcRequest, TckRpcResponse);

      await server.serve(async () => {
        throw new Error("handler-exploded");
      });

      await wait(500);

      const req = new TckRpcRequest();
      req.question = "boom";

      await expect(client.request(req)).rejects.toThrow("handler-exploded");

      await server.unserveAll();
      await client.close();
    });

    test("should handle multiple sequential requests from the same client", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const server = handle.rpcServer(TckRpcRequest, TckRpcResponse);
      const client = handle.rpcClient(TckRpcRequest, TckRpcResponse);

      await server.serve(async (req) => {
        const res = new TckRpcResponse();
        res.answer = `reply-${req.question}`;
        return res;
      });

      await wait(500);

      const questions = ["alpha", "beta", "gamma"];
      const answers: Array<string> = [];

      for (const q of questions) {
        const req = new TckRpcRequest();
        req.question = q;
        const res = await client.request(req);
        answers.push(res.answer);
      }

      expect(answers).toEqual(["reply-alpha", "reply-beta", "reply-gamma"]);

      await server.unserveAll();
      await client.close();
    });

    test("should preserve message fields in request/response roundtrip", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const server = handle.rpcServer(TckRpcRequest, TckRpcResponse);
      const client = handle.rpcClient(TckRpcRequest, TckRpcResponse);

      await server.serve(async (req) => {
        const res = new TckRpcResponse();
        // Echo back the question as the answer to verify field integrity
        res.answer = req.question;
        return res;
      });

      await wait(500);

      const req = new TckRpcRequest();
      req.question = "field-with-special-chars-!@#$%";

      const response = await client.request(req);

      expect(response.answer).toBe("field-with-special-chars-!@#$%");

      await server.unserveAll();
      await client.close();
    });

    test("should propagate specific error message from handler to client", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const server = handle.rpcServer(TckRpcRequest, TckRpcResponse);
      const client = handle.rpcClient(TckRpcRequest, TckRpcResponse);

      await server.serve(async () => {
        throw new Error("specific-error-message-12345");
      });

      await wait(500);

      const req = new TckRpcRequest();
      req.question = "trigger-error";

      await expect(client.request(req)).rejects.toThrow("specific-error-message-12345");

      await server.unserveAll();
      await client.close();
    });

    test("should allow calling client close twice without error", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const client = handle.rpcClient(TckRpcRequest, TckRpcResponse);

      await client.close();
      await client.close();
    });

    test("should allow calling server unserve twice without error", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const server = handle.rpcServer(TckRpcRequest, TckRpcResponse);

      await server.serve(async (req) => {
        const res = new TckRpcResponse();
        res.answer = req.question;
        return res;
      });

      await server.unserve();
      await server.unserve();
    });

    test("should reject pending requests on close", async () => {
      const handle = getHandle();
      const { TckRpcRequest, TckRpcResponse } = messages;

      const server = handle.rpcServer(TckRpcRequest, TckRpcResponse);
      const client = handle.rpcClient(TckRpcRequest, TckRpcResponse);

      // Handler that takes a long time
      await server.serve(async () => {
        return new Promise<never>(() => {
          // intentionally never resolves
        });
      });

      await wait(500);

      const req = new TckRpcRequest();
      req.question = "closing";

      const requestPromise = client.request(req, { timeout: 5000 });

      // Close immediately
      await client.close();

      await expect(requestPromise).rejects.toThrow(IrisError);

      await server.unserveAll();
    });
  });
};
