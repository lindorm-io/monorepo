import { createMockRpcClient } from "./vitest.js";
import { beforeEach, describe, expect, it } from "vitest";

type TestReq = { id: string; query: string };
type TestRes = { id: string; result: string };

describe("createMockRpcClient", () => {
  describe("with responseFactory", () => {
    let mock: ReturnType<typeof createMockRpcClient<TestReq, TestRes>>;

    beforeEach(() => {
      mock = createMockRpcClient<TestReq, TestRes>((req) => ({
        id: req.id,
        result: "response-for-" + req.query,
      }));
    });

    describe("request", () => {
      it("should call responseFactory and return result", async () => {
        const result = await mock.request({ id: "1", query: "hello" });
        expect(result).toMatchSnapshot();
      });

      it("should record requests", async () => {
        await mock.request({ id: "1", query: "a" });
        await mock.request({ id: "2", query: "b" });
        expect(mock.requests).toMatchSnapshot();
      });

      it("should track call arguments", async () => {
        const req: TestReq = { id: "1", query: "hello" };
        await mock.request(req, { timeout: 5000 });
        expect(mock.request).toHaveBeenCalledWith(req, { timeout: 5000 });
      });
    });

    describe("clearRequests", () => {
      it("should clear the requests array", async () => {
        await mock.request({ id: "1", query: "hello" });
        expect(mock.requests).toHaveLength(1);
        mock.clearRequests();
        expect(mock.requests).toHaveLength(0);
      });
    });
  });

  describe("with async responseFactory", () => {
    it("should handle async factory", async () => {
      const mock = createMockRpcClient<TestReq, TestRes>(async (req) => ({
        id: req.id,
        result: "async-" + req.query,
      }));
      const result = await mock.request({ id: "1", query: "hello" });
      expect(result).toMatchSnapshot();
    });
  });

  describe("without responseFactory", () => {
    it("should throw when request is called", async () => {
      const mock = createMockRpcClient<TestReq, TestRes>();
      await expect(mock.request({ id: "1", query: "hello" })).rejects.toThrow(
        "MockRpcClient: no responseFactory provided — supply one via the constructor",
      );
    });

    it("should still record the request before throwing", async () => {
      const mock = createMockRpcClient<TestReq, TestRes>();
      await expect(mock.request({ id: "1", query: "hello" })).rejects.toThrow();
      expect(mock.requests).toHaveLength(1);
    });
  });

  describe("close", () => {
    it("should be a no-op", async () => {
      const mock = createMockRpcClient<TestReq, TestRes>();
      await mock.close();
      expect(mock.close).toHaveBeenCalled();
    });
  });
});
