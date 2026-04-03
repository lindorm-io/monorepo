import { createMockLogger } from "@lindorm/logger";
import { createAmphoraRefreshWorker } from "./amphora-refresh-worker";

describe("createAmphoraRefreshWorker", () => {
  const mockRefresh = jest.fn().mockResolvedValue(undefined);
  const amphora: any = { refresh: mockRefresh };
  const ctx: any = { logger: createMockLogger() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return a worker config with correct alias", () => {
    const config = createAmphoraRefreshWorker({ amphora });

    expect(config.alias).toBe("AmphoraRefreshWorker");
  });

  test("should default interval to 15m", () => {
    const config = createAmphoraRefreshWorker({ amphora });

    expect(config.interval).toBe("15m");
  });

  test("should default listeners to empty array", () => {
    const config = createAmphoraRefreshWorker({ amphora });

    expect(config.listeners).toEqual([]);
  });

  test("should use provided interval", () => {
    const config = createAmphoraRefreshWorker({ amphora, interval: "5m" });

    expect(config.interval).toBe("5m");
  });

  test("should use provided listeners", () => {
    const listeners: any = [{ event: "test" }];
    const config = createAmphoraRefreshWorker({ amphora, listeners });

    expect(config.listeners).toBe(listeners);
  });

  test("should pass through jitter and retry", () => {
    const config = createAmphoraRefreshWorker({
      amphora,
      jitter: "2s",
      retry: 5,
    } as any);

    expect(config.jitter).toBe("2s");
    expect(config.retry).toBe(5);
  });

  test("should bind amphora.refresh as callback", async () => {
    const config = createAmphoraRefreshWorker({ amphora });

    await config.callback(ctx);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
