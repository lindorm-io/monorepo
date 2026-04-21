import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createWorkerQueueMiddleware } from "./create-worker-queue-middleware.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../../internal/utils/resolve-iris.js");
import { resolveIris } from "../../internal/utils/resolve-iris.js";

class OrderCreatedEvent {}
class UserUpdatedEvent {}

describe("createWorkerQueueMiddleware", async () => {
  let ctx: any;
  let next: Mock;
  let mockWorkerQueue: any;
  let mockSource: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWorkerQueue = { enqueue: vi.fn() };
    mockSource = { workerQueue: vi.fn().mockReturnValue(mockWorkerQueue) };
    (resolveIris as Mock).mockReturnValue(mockSource);

    ctx = { logger: createMockLogger() };
    next = vi.fn();
  });

  test("should call next", async () => {
    await createWorkerQueueMiddleware([OrderCreatedEvent])(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should set ctx.workerQueues with correct camelCased keys", async () => {
    await createWorkerQueueMiddleware([OrderCreatedEvent, UserUpdatedEvent])(ctx, next);

    expect(ctx.workerQueues).toBeDefined();
    expect(Object.keys(ctx.workerQueues)).toMatchSnapshot();
  });

  test("should lazily create worker queues", async () => {
    await createWorkerQueueMiddleware([OrderCreatedEvent])(ctx, next);

    expect(mockSource.workerQueue).not.toHaveBeenCalled();

    const wq = ctx.workerQueues.orderCreatedEvent;

    expect(mockSource.workerQueue).toHaveBeenCalledTimes(1);
    expect(mockSource.workerQueue).toHaveBeenCalledWith(OrderCreatedEvent);
    expect(wq).toBe(mockWorkerQueue);
  });

  test("should cache on second access", async () => {
    await createWorkerQueueMiddleware([OrderCreatedEvent])(ctx, next);

    const wq1 = ctx.workerQueues.orderCreatedEvent;
    const wq2 = ctx.workerQueues.orderCreatedEvent;

    expect(mockSource.workerQueue).toHaveBeenCalledTimes(1);
    expect(wq1).toBe(wq2);
  });

  test("should pass the override source to resolveIris when provided", async () => {
    const overrideSource: any = { workerQueue: vi.fn() };

    await createWorkerQueueMiddleware([OrderCreatedEvent], overrideSource)(ctx, next);

    expect(resolveIris).toHaveBeenCalledWith(ctx, overrideSource);
  });

  test("should throw ServerError when resolveIris throws", async () => {
    (resolveIris as Mock).mockImplementation(() => {
      throw new ServerError("IrisSource is not configured");
    });

    await expect(
      createWorkerQueueMiddleware([OrderCreatedEvent])(ctx, next),
    ).rejects.toThrow(ServerError);
  });
});
