import { defaultCreateEntity } from "@lindorm/entity";
import { createMockLogger } from "@lindorm/logger";
import { createMockMnemosRepository, createMockMnemosSource } from "@lindorm/mnemos";
import { MnemosJobEntity } from "../../entities";
import { QueueFailedError } from "../../errors";
import { createWorkerQueueCallback } from "./worker-queue-callback";

describe("createWorkerQueueErrorCallback", () => {
  let options: any;
  let ctx: any;
  let repository: any;

  beforeEach(() => {
    options = {
      source: createMockMnemosSource(),
      target: MnemosJobEntity,
      callback: jest.fn(),
    };

    ctx = {
      logger: createMockLogger(),
    };

    repository = createMockMnemosRepository(MnemosJobEntity);
    repository.find.mockImplementation(async () => [
      defaultCreateEntity(MnemosJobEntity, {
        event: "one",
        payload: { one: 1 },
        priority: 1,
      }),
      defaultCreateEntity(MnemosJobEntity, {
        event: "two",
        payload: { two: 2 },
        priority: 2,
      }),
    ]);

    options.source.repository.mockReturnValue(repository);
  });

  afterEach(jest.clearAllMocks);

  test("should resolve", async () => {
    await expect(createWorkerQueueCallback(options)(ctx)).resolves.toBeUndefined();

    expect(options.callback).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ event: "two" }),
    );

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "two",
        acknowledgedAt: expect.any(Date),
      }),
    );

    expect(repository.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ event: "two" }),
    );
  });

  test("should recover from error", async () => {
    options.callback.mockRejectedValue(new Error("test"));

    await expect(createWorkerQueueCallback(options)(ctx)).rejects.toThrow(
      QueueFailedError,
    );

    expect(options.callback).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ event: "two" }),
    );

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        acknowledgedAt: null,
      }),
    );
  });
});
