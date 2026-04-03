import { AesKit } from "@lindorm/aes";
import { IAmphora } from "@lindorm/amphora";
import { IKryptos, KryptosDB, KryptosKit } from "@lindorm/kryptos";
import { IProteusSource } from "@lindorm/proteus";
import { Constructor } from "@lindorm/types";
import { CreateLindormWorkerOptions, LindormWorkerConfig } from "@lindorm/worker";

type Options = CreateLindormWorkerOptions & {
  amphora: IAmphora;
  encryptionKey?: IKryptos;
  proteus: IProteusSource;
  target: Constructor<KryptosDB>;
};

export const createAmphoraEntityWorker = (options: Options): LindormWorkerConfig => ({
  alias: "AmphoraEntityWorker",
  interval: options.interval ?? "3m",
  listeners: options.listeners ?? [],
  jitter: options.jitter,
  retry: options.retry,
  callback: async (ctx): Promise<void> => {
    ctx.logger.debug("Refreshing amphora from external sources");

    await options.amphora.refresh();

    const aes = options.encryptionKey
      ? new AesKit({ kryptos: options.encryptionKey })
      : undefined;

    const repository = options.proteus.repository(options.target);
    const existing = await repository.find();

    ctx.logger.debug("Loaded kryptos entities from database", { count: existing.length });

    const keys: Array<IKryptos> = [];

    for (const data of existing) {
      if (aes && data.privateKey && AesKit.isAesTokenised(data.privateKey)) {
        data.privateKey = aes.decrypt<string>(data.privateKey);
      }

      keys.push(KryptosKit.from.db(data));
    }

    options.amphora.add(keys);

    ctx.logger.info("Amphora entity sync complete", { keys: keys.length });
  },
});
