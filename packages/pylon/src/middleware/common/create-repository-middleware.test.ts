import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createRepositoryMiddleware } from "./create-repository-middleware";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../../internal/utils/resolve-proteus");
import { resolveProteus } from "../../internal/utils/resolve-proteus";

class UserEntity {}
class OrderEntity {}

describe("createRepositoryMiddleware", async () => {
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
    await createRepositoryMiddleware([UserEntity])(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should set ctx.repositories with correct camelCased keys", async () => {
    await createRepositoryMiddleware([UserEntity, OrderEntity])(ctx, next);

    expect(ctx.repositories).toBeDefined();
    expect(Object.keys(ctx.repositories)).toMatchSnapshot();
  });

  test("should lazily create repositories", async () => {
    await createRepositoryMiddleware([UserEntity])(ctx, next);

    expect(mockSource.repository).not.toHaveBeenCalled();

    const repo = ctx.repositories.userEntity;

    expect(mockSource.repository).toHaveBeenCalledTimes(1);
    expect(mockSource.repository).toHaveBeenCalledWith(UserEntity);
    expect(repo).toBe(mockRepository);
  });

  test("should cache the repository on second access", async () => {
    await createRepositoryMiddleware([UserEntity])(ctx, next);

    const repo1 = ctx.repositories.userEntity;
    const repo2 = ctx.repositories.userEntity;

    expect(mockSource.repository).toHaveBeenCalledTimes(1);
    expect(repo1).toBe(repo2);
  });

  test("should pass the override source to resolveProteus when provided", async () => {
    const overrideSource: any = { repository: vi.fn() };

    await createRepositoryMiddleware([UserEntity], overrideSource)(ctx, next);

    expect(resolveProteus).toHaveBeenCalledWith(ctx, overrideSource);
  });

  test("should throw ServerError when resolveProteus throws", async () => {
    (resolveProteus as Mock).mockImplementation(() => {
      throw new ServerError("ProteusSource is not configured");
    });

    await expect(createRepositoryMiddleware([UserEntity])(ctx, next)).rejects.toThrow(
      ServerError,
    );
  });
});
