import { RedisCacheAdapter } from "./RedisCacheAdapter";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Plain mock object — no ioredis module import needed.
// The adapter only uses get/set/del/eval, so we mock exactly those.
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();
const mockEval = jest.fn();

const mockClient = {
  get: mockGet,
  set: mockSet,
  del: mockDel,
  eval: mockEval,
} as any;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createAdapter = (options?: { keyPrefix?: string; scanCount?: number }) =>
  new RedisCacheAdapter({ client: mockClient, ...options });

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RedisCacheAdapter", () => {
  // ─── constructor ──────────────────────────────────────────────────────

  describe("constructor", () => {
    test("defaults keyPrefix to empty string when not provided", async () => {
      const adapter = createAdapter();
      // Exercise via get so the prefix is visible in the call argument.
      mockGet.mockResolvedValue(null);
      await adapter.get("mykey");
      expect(mockGet).toHaveBeenCalledWith("mykey");
    });

    test("defaults scanCount to 500 when not provided", async () => {
      mockEval.mockResolvedValue(0);
      const adapter = createAdapter();
      await adapter.delByPrefix("some:");
      // Fifth argument (after script, numkeys, pattern) is scanCount.
      expect(mockEval).toHaveBeenCalledWith(expect.any(String), 1, "some:*", 500);
    });

    test("uses provided keyPrefix", async () => {
      mockGet.mockResolvedValue(null);
      const adapter = createAdapter({ keyPrefix: "app:" });
      await adapter.get("key");
      expect(mockGet).toHaveBeenCalledWith("app:key");
    });

    test("uses provided scanCount", async () => {
      mockEval.mockResolvedValue(0);
      const adapter = createAdapter({ scanCount: 100 });
      await adapter.delByPrefix("prefix:");
      expect(mockEval).toHaveBeenCalledWith(expect.any(String), 1, "prefix:*", 100);
    });
  });

  // ─── get ──────────────────────────────────────────────────────────────

  describe("get", () => {
    test("returns cached value on cache hit", async () => {
      mockGet.mockResolvedValue('{"foo":"bar"}');
      const adapter = createAdapter();

      const result = await adapter.get("hit-key");

      expect(result).toBe('{"foo":"bar"}');
    });

    test("returns null on cache miss", async () => {
      mockGet.mockResolvedValue(null);
      const adapter = createAdapter();

      const result = await adapter.get("miss-key");

      expect(result).toBeNull();
    });

    test("prepends keyPrefix to the key", async () => {
      mockGet.mockResolvedValue(null);
      const adapter = createAdapter({ keyPrefix: "tenant1:" });

      await adapter.get("cache:User:abc");

      expect(mockGet).toHaveBeenCalledWith("tenant1:cache:User:abc");
    });

    test("passes bare key when keyPrefix is empty (default)", async () => {
      mockGet.mockResolvedValue(null);
      const adapter = createAdapter();

      await adapter.get("cache:User:abc");

      expect(mockGet).toHaveBeenCalledWith("cache:User:abc");
    });
  });

  // ─── set ──────────────────────────────────────────────────────────────

  describe("set", () => {
    test("calls client.set with key, value, PX flag, and ttlMs", async () => {
      mockSet.mockResolvedValue("OK");
      const adapter = createAdapter();

      await adapter.set("cache:User:123", '{"id":"123"}', 60000);

      expect(mockSet).toMatchSnapshot();
    });

    test("is a no-op when ttlMs is 0", async () => {
      const adapter = createAdapter();

      await adapter.set("key", "value", 0);

      expect(mockSet).not.toHaveBeenCalled();
    });

    test("throws when ttlMs is negative", async () => {
      const adapter = createAdapter();

      await expect(adapter.set("key", "value", -1)).rejects.toThrow("Invalid ttlMs: -1");
    });

    test("throws for any negative ttlMs value", async () => {
      const adapter = createAdapter();

      await expect(adapter.set("key", "value", -999)).rejects.toThrow(
        "Invalid ttlMs: -999",
      );
    });

    test("prepends keyPrefix to the key", async () => {
      mockSet.mockResolvedValue("OK");
      const adapter = createAdapter({ keyPrefix: "app:" });

      await adapter.set("cache:User:99", "data", 5000);

      expect(mockSet).toHaveBeenCalledWith("app:cache:User:99", "data", "PX", 5000);
    });

    test("passes bare key when keyPrefix is empty (default)", async () => {
      mockSet.mockResolvedValue("OK");
      const adapter = createAdapter();

      await adapter.set("cache:User:99", "data", 5000);

      expect(mockSet).toHaveBeenCalledWith("cache:User:99", "data", "PX", 5000);
    });
  });

  // ─── del ──────────────────────────────────────────────────────────────

  describe("del", () => {
    test("calls client.del with the correct key", async () => {
      mockDel.mockResolvedValue(1);
      const adapter = createAdapter();

      await adapter.del("cache:User:42");

      expect(mockDel).toHaveBeenCalledWith("cache:User:42");
    });

    test("prepends keyPrefix to the key", async () => {
      mockDel.mockResolvedValue(1);
      const adapter = createAdapter({ keyPrefix: "ns:" });

      await adapter.del("cache:User:42");

      expect(mockDel).toHaveBeenCalledWith("ns:cache:User:42");
    });

    test("passes bare key when keyPrefix is empty (default)", async () => {
      mockDel.mockResolvedValue(1);
      const adapter = createAdapter();

      await adapter.del("cache:User:42");

      expect(mockDel).toHaveBeenCalledWith("cache:User:42");
    });
  });

  // ─── delByPrefix ──────────────────────────────────────────────────────

  describe("delByPrefix", () => {
    test("calls client.eval with Lua script, numkeys=1, pattern with wildcard, and scanCount", async () => {
      mockEval.mockResolvedValue(7);
      const adapter = createAdapter({ scanCount: 200 });

      await adapter.delByPrefix("cache:User:");

      expect(mockEval).toMatchSnapshot();
    });

    test("appends * wildcard to the pattern", async () => {
      mockEval.mockResolvedValue(0);
      const adapter = createAdapter();

      await adapter.delByPrefix("cache:Post:");

      const [, , pattern] = mockEval.mock.calls[0];
      expect(pattern).toBe("cache:Post:*");
    });

    test("prepends keyPrefix to the pattern", async () => {
      mockEval.mockResolvedValue(0);
      const adapter = createAdapter({ keyPrefix: "myapp:" });

      await adapter.delByPrefix("cache:User:");

      const [, , pattern] = mockEval.mock.calls[0];
      expect(pattern).toBe("myapp:cache:User:*");
    });

    test("passes bare pattern when keyPrefix is empty (default)", async () => {
      mockEval.mockResolvedValue(0);
      const adapter = createAdapter();

      await adapter.delByPrefix("cache:User:");

      const [, , pattern] = mockEval.mock.calls[0];
      expect(pattern).toBe("cache:User:*");
    });

    test("uses configured scanCount as the COUNT hint", async () => {
      mockEval.mockResolvedValue(0);
      const adapter = createAdapter({ scanCount: 1000 });

      await adapter.delByPrefix("cache:");

      const [, , , scanCount] = mockEval.mock.calls[0];
      expect(scanCount).toBe(1000);
    });

    test("passes numkeys=1 to client.eval", async () => {
      mockEval.mockResolvedValue(0);
      const adapter = createAdapter();

      await adapter.delByPrefix("cache:");

      const [, numkeys] = mockEval.mock.calls[0];
      expect(numkeys).toBe(1);
    });
  });
});
