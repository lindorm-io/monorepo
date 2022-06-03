import { InMemoryCache } from "./InMemoryCache";
import { createMockLogger } from "@lindorm-io/winston";
import { sleep } from "@lindorm-io/core";

describe("InMemoryCache", () => {
  let cache: InMemoryCache<any>;

  const logger = createMockLogger();

  beforeEach(() => {
    cache = new InMemoryCache<any>({
      name: "testCache",
      logger,
      getKeyFunction: (data) => data.id,
      fetchDataFunction: async (ctx) => {
        await sleep(250);
        ctx.clear();
        ctx.set({ id: "1", value: "one" });
      },
    });
  });

  test("should get undefined value from cache", () => {
    expect(cache.get("1")).toBeUndefined();
  });

  test("should await and get fetched value from cache", async () => {
    await expect(cache.getAsync("1")).resolves.toMatchSnapshot();
  });

  test("should set a new value in cache", () => {
    cache.set({ id: "2", value: "two" });
    expect(cache.get("2")).toMatchSnapshot();
  });

  test("should delete a value from cache", async () => {
    await cache.reload();
    cache.delete("1");
    expect(cache.get("1")).toBeUndefined();
  });

  test("should destroy a value from cache", async () => {
    await cache.reload();
    cache.destroy({ id: "1" });
    expect(cache.get("1")).toBeUndefined();
  });

  test("should scan values from cache", async () => {
    await cache.reload();
    expect(cache.scan()).toMatchSnapshot();
  });

  test("should scan values async from cache", async () => {
    await expect(cache.scanAsync()).resolves.toMatchSnapshot();
  });

  test("should resolve status", () => {
    expect(cache.status()).toStrictEqual({
      fetching: true,
      size: 0,
      timestamp: undefined,
      ttl: 720,
    });
  });

  test("should resolve data fetch on heartbeat", async () => {
    await cache.heartbeat();
    expect(cache.status()).toStrictEqual({
      fetching: false,
      size: 1,
      timestamp: expect.any(Date),
      ttl: 720,
    });
  });
});
