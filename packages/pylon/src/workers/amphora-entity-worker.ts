import type { IAmphora } from "@lindorm/amphora";
import { type IKryptos, type KryptosDB, KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import type { Constructor } from "@lindorm/types";
import { type CreateLindormWorkerOptions, LindormWorker } from "@lindorm/worker";

type Options = CreateLindormWorkerOptions & {
  amphora: IAmphora;
  logger: ILogger;
  proteus: IProteusSource;
  target?: Constructor<KryptosDB>;
};

export const createAmphoraEntityWorker = (options: Options): LindormWorker =>
  new LindormWorker({
    alias: "AmphoraEntityWorker",
    interval: options.interval ?? "3m",
    listeners: options.listeners ?? [],
    jitter: options.jitter,
    retry: options.retry,
    logger: options.logger,
    callback: async (ctx): Promise<void> => {
      const target = options.target ?? (await import("../entities/Kryptos.js")).Kryptos;
      const repository = options.proteus.repository(target);
      const existing = await repository.find();

      ctx.logger.debug("Loaded kryptos entities from database", {
        count: existing.length,
      });

      const keys: Array<IKryptos> = [];

      for (const data of existing) {
        keys.push(KryptosKit.from.db(data));
      }

      options.amphora.add(keys);

      ctx.logger.info("Amphora entity sync complete", { keys: keys.length });
    },
  });
