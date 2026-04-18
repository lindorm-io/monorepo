import { IAmphora } from "@lindorm/amphora";
import { IKryptos, KryptosDB, KryptosKit } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { IProteusSource } from "@lindorm/proteus";
import { Constructor } from "@lindorm/types";
import { CreateLindormWorkerOptions, LindormWorker } from "@lindorm/worker";
import { Kryptos } from "../entities/Kryptos";

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
      const repository = options.proteus.repository(options.target ?? Kryptos);
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
