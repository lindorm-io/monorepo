import { createMockLogger } from "@lindorm/logger";
import { createMockMnemosRepository, createMockMnemosSource } from "@lindorm/mnemos";
import { LindormWorkerError } from "@lindorm/worker/dist/errors/LindormWorkerError";
import { MnemosJobEntity } from "../../entities";
import { QueueFailedError } from "../../errors";
import { createWorkerQueueErrorCallback } from "./worker-queue-error-callback";

describe("createWorkerQueueErrorCallback", () => {
  let options: any;
  let ctx: any;
  let repository: any;

  beforeEach(() => {
    options = {
      source: createMockMnemosSource(),
      target: MnemosJobEntity,
    };

    ctx = {
      logger: createMockLogger(),
    };

    repository = createMockMnemosRepository(MnemosJobEntity);
    options.source.repository.mockReturnValue(repository);
  });

  test("should resolve error", async () => {
    await expect(
      createWorkerQueueErrorCallback(options)(
        ctx,
        new QueueFailedError("test", {
          debug: { id: "9d0d2646-142c-5992-a8ff-3b7c88bf736c" },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(repository.findOneOrFail).toHaveBeenCalledWith({
      id: "9d0d2646-142c-5992-a8ff-3b7c88bf736c",
    });

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        failedAt: expect.any(Date),
      }),
    );
  });

  test("should skip standard errors", async () => {
    await expect(
      createWorkerQueueErrorCallback(options)(ctx, new LindormWorkerError("test")),
    ).resolves.toBeUndefined();

    expect(repository.findOneOrFail).not.toHaveBeenCalled();
  });
});
