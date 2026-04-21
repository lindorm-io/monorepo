import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createCacheMiddleware } from "./create-cache-middleware";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../../internal/utils/resolve-proteus");
import { resolveProteus } from "../../internal/utils/resolve-proteus";

class Session {}
class TokenEntity {}

describe("createCacheMiddleware", async () => {
  let ctx: any;
  let next: Mock;
  let mockRepository: any;
  let mockSource: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepository = { find: vi.fn() };
    mockSource = { repository: vi.fn().mockReturnValue(mockRepository) };
    (resolveProteus as Mock).mockReturnValue(mockSource);

    ctx = { logger: createMockLogger() };
    next = vi.fn();
  });

  test("should call next", async () => {
    await createCacheMiddleware([Session])(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should set ctx.caches with correct camelCased keys", async () => {
    await createCacheMiddleware([Session, TokenEntity])(ctx, next);

    expect(ctx.caches).toBeDefined();
    expect(Object.keys(ctx.caches)).toMatchSnapshot();
  });

  test("should lazily create caches", async () => {
    await createCacheMiddleware([Session])(ctx, next);

    expect(mockSource.repository).not.toHaveBeenCalled();

    const cache = ctx.caches.session;

    expect(mockSource.repository).toHaveBeenCalledTimes(1);
    expect(mockSource.repository).toHaveBeenCalledWith(Session);
    expect(cache).toBe(mockRepository);
  });

  test("should cache on second access", async () => {
    await createCacheMiddleware([Session])(ctx, next);

    const cache1 = ctx.caches.session;
    const cache2 = ctx.caches.session;

    expect(mockSource.repository).toHaveBeenCalledTimes(1);
    expect(cache1).toBe(cache2);
  });

  test("should pass the override source to resolveProteus when provided", async () => {
    const overrideSource: any = { repository: vi.fn() };

    await createCacheMiddleware([Session], overrideSource)(ctx, next);

    expect(resolveProteus).toHaveBeenCalledWith(ctx, overrideSource);
  });

  test("should throw ServerError when resolveProteus throws", async () => {
    (resolveProteus as Mock).mockImplementation(() => {
      throw new ServerError("ProteusSource is not configured");
    });

    await expect(createCacheMiddleware([Session])(ctx, next)).rejects.toThrow(
      ServerError,
    );
  });
});
