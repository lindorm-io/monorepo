import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { createCacheMiddleware } from "./create-cache-middleware";

jest.mock("#internal/utils/resolve-proteus");
import { resolveProteus } from "#internal/utils/resolve-proteus";

class SessionEntity {}
class TokenEntity {}

describe("createCacheMiddleware", () => {
  let ctx: any;
  let next: jest.Mock;
  let mockRepository: any;
  let mockSource: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = { find: jest.fn() };
    mockSource = { repository: jest.fn().mockReturnValue(mockRepository) };
    (resolveProteus as jest.Mock).mockReturnValue(mockSource);

    ctx = { logger: createMockLogger() };
    next = jest.fn();
  });

  test("should call next", async () => {
    await createCacheMiddleware([SessionEntity])(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should set ctx.caches with correct camelCased keys", async () => {
    await createCacheMiddleware([SessionEntity, TokenEntity])(ctx, next);

    expect(ctx.caches).toBeDefined();
    expect(Object.keys(ctx.caches)).toMatchSnapshot();
  });

  test("should lazily create caches", async () => {
    await createCacheMiddleware([SessionEntity])(ctx, next);

    expect(mockSource.repository).not.toHaveBeenCalled();

    const cache = ctx.caches.sessionEntity;

    expect(mockSource.repository).toHaveBeenCalledTimes(1);
    expect(mockSource.repository).toHaveBeenCalledWith(SessionEntity);
    expect(cache).toBe(mockRepository);
  });

  test("should cache on second access", async () => {
    await createCacheMiddleware([SessionEntity])(ctx, next);

    const cache1 = ctx.caches.sessionEntity;
    const cache2 = ctx.caches.sessionEntity;

    expect(mockSource.repository).toHaveBeenCalledTimes(1);
    expect(cache1).toBe(cache2);
  });

  test("should pass the override source to resolveProteus when provided", async () => {
    const overrideSource: any = { repository: jest.fn() };

    await createCacheMiddleware([SessionEntity], overrideSource)(ctx, next);

    expect(resolveProteus).toHaveBeenCalledWith(ctx, overrideSource);
  });

  test("should throw ServerError when resolveProteus throws", async () => {
    (resolveProteus as jest.Mock).mockImplementation(() => {
      throw new ServerError("ProteusSource is not configured");
    });

    await expect(createCacheMiddleware([SessionEntity])(ctx, next)).rejects.toThrow(
      ServerError,
    );
  });
});
