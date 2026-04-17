import { createMockLogger } from "@lindorm/logger";
import { LindormWorker } from "@lindorm/worker";
import { createAmphoraRefreshWorker } from "./amphora-refresh-worker";

describe("createAmphoraRefreshWorker", () => {
  const mockRefresh = jest.fn().mockResolvedValue(undefined);
  const amphora: any = { refresh: mockRefresh };
  const logger = createMockLogger();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return a LindormWorker instance with correct alias", () => {
    const worker = createAmphoraRefreshWorker({ amphora, logger });

    expect(worker).toBeInstanceOf(LindormWorker);
    expect(worker.alias).toBe("AmphoraRefreshWorker");
  });

  test("should trigger callback that refreshes amphora", async () => {
    const worker = createAmphoraRefreshWorker({ amphora, logger });

    await worker.trigger();

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test("should use provided interval without throwing", () => {
    expect(() =>
      createAmphoraRefreshWorker({ amphora, logger, interval: "5m" }),
    ).not.toThrow();
  });

  test("should accept listeners, jitter and retry overrides", () => {
    expect(() =>
      createAmphoraRefreshWorker({
        amphora,
        logger,
        listeners: [{ event: "start", listener: () => {} }],
        jitter: "2s",
        retry: { maxAttempts: 5 },
      }),
    ).not.toThrow();
  });
});
