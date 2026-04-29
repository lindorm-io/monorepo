import type { ILogger } from "@lindorm/logger";
import type { IEntity, IProteusSource } from "@lindorm/proteus";
import type { Constructor } from "@lindorm/types";
import { type CreateLindormWorkerOptions, LindormWorker } from "@lindorm/worker";

type Options = CreateLindormWorkerOptions & {
  logger: ILogger;
  proteus: IProteusSource;
  targets: Array<Constructor<IEntity>>;
};

export const createExpiryCleanupWorker = (options: Options): LindormWorker =>
  new LindormWorker({
    alias: "ExpiryCleanupWorker",
    interval: options.interval ?? "15m",
    listeners: options.listeners ?? [],
    jitter: options.jitter,
    retry: options.retry,
    logger: options.logger,
    callback: async (ctx): Promise<void> => {
      const errors: Array<{ target: string; error: Error }> = [];

      for (const target of options.targets) {
        try {
          ctx.logger.debug("Deleting expired entities", { target: target.name });

          const repository = options.proteus.repository(target);
          await repository.deleteExpired();

          ctx.logger.debug("Expired entities deleted", { target: target.name });
        } catch (error: any) {
          ctx.logger.warn("Failed to delete expired entities", {
            target: target.name,
            error,
          });
          errors.push({ target: target.name, error });
        }
      }

      if (errors.length) {
        ctx.logger.warn("Expiry cleanup completed with errors", {
          total: options.targets.length,
          failed: errors.length,
        });
      } else {
        ctx.logger.info("Expiry cleanup complete", { targets: options.targets.length });
      }
    },
  });
