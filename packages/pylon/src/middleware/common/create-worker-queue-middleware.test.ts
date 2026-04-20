import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { createWorkerQueueMiddleware } from "./create-worker-queue-middleware";

jest.mock("../../internal/utils/resolve-iris");
import { resolveIris } from "../../internal/utils/resolve-iris";

class OrderCreatedEvent {}
class UserUpdatedEvent {}

describe("createWorkerQueueMiddleware", () => {
  let ctx: any;
  let next: jest.Mock;
  let mockWorkerQueue: any;
  let mockSource: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWorkerQueue = { enqueue: jest.fn() };
    mockSource = { workerQueue: jest.fn().mockReturnValue(mockWorkerQueue) };
    (resolveIris as jest.Mock).mockReturnValue(mockSource);

    ctx = { logger: createMockLogger() };
    next = jest.fn();
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
    const overrideSource: any = { workerQueue: jest.fn() };

    await createWorkerQueueMiddleware([OrderCreatedEvent], overrideSource)(ctx, next);

    expect(resolveIris).toHaveBeenCalledWith(ctx, overrideSource);
  });

  test("should throw ServerError when resolveIris throws", async () => {
    (resolveIris as jest.Mock).mockImplementation(() => {
      throw new ServerError("IrisSource is not configured");
    });

    await expect(
      createWorkerQueueMiddleware([OrderCreatedEvent])(ctx, next),
    ).rejects.toThrow(ServerError);
  });
});
