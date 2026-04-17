import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { createPublisherMiddleware } from "./create-publisher-middleware";

jest.mock("../../internal/utils/resolve-iris");
import { resolveIris } from "../../internal/utils/resolve-iris";

class OrderCreatedEvent {}
class UserUpdatedEvent {}

describe("createPublisherMiddleware", () => {
  let ctx: any;
  let next: jest.Mock;
  let mockPublisher: any;
  let mockSource: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPublisher = { publish: jest.fn() };
    mockSource = { publisher: jest.fn().mockReturnValue(mockPublisher) };
    (resolveIris as jest.Mock).mockReturnValue(mockSource);

    ctx = { logger: createMockLogger() };
    next = jest.fn();
  });

  test("should call next", async () => {
    await createPublisherMiddleware([OrderCreatedEvent])(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should set ctx.publishers with correct camelCased keys", async () => {
    await createPublisherMiddleware([OrderCreatedEvent, UserUpdatedEvent])(ctx, next);

    expect(ctx.publishers).toBeDefined();
    expect(Object.keys(ctx.publishers)).toMatchSnapshot();
  });

  test("should lazily create publishers", async () => {
    await createPublisherMiddleware([OrderCreatedEvent])(ctx, next);

    expect(mockSource.publisher).not.toHaveBeenCalled();

    const pub = ctx.publishers.orderCreatedEvent;

    expect(mockSource.publisher).toHaveBeenCalledTimes(1);
    expect(mockSource.publisher).toHaveBeenCalledWith(OrderCreatedEvent);
    expect(pub).toBe(mockPublisher);
  });

  test("should cache on second access", async () => {
    await createPublisherMiddleware([OrderCreatedEvent])(ctx, next);

    const pub1 = ctx.publishers.orderCreatedEvent;
    const pub2 = ctx.publishers.orderCreatedEvent;

    expect(mockSource.publisher).toHaveBeenCalledTimes(1);
    expect(pub1).toBe(pub2);
  });

  test("should pass the override source to resolveIris when provided", async () => {
    const overrideSource: any = { publisher: jest.fn() };

    await createPublisherMiddleware([OrderCreatedEvent], overrideSource)(ctx, next);

    expect(resolveIris).toHaveBeenCalledWith(ctx, overrideSource);
  });

  test("should throw ServerError when resolveIris throws", async () => {
    (resolveIris as jest.Mock).mockImplementation(() => {
      throw new ServerError("IrisSource is not configured");
    });

    await expect(
      createPublisherMiddleware([OrderCreatedEvent])(ctx, next),
    ).rejects.toThrow(ServerError);
  });
});
