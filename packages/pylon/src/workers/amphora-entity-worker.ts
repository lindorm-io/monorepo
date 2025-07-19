import { AesKit } from "@lindorm/aes";
import { IAmphora } from "@lindorm/amphora";
import { IKryptos, KryptosDB, KryptosKit } from "@lindorm/kryptos";
import { IMongoSource } from "@lindorm/mongo";
import { Constructor } from "@lindorm/types";
import { CreateLindormWorkerOptions, LindormWorkerConfig } from "@lindorm/worker";

type Options = CreateLindormWorkerOptions & {
  amphora: IAmphora;
  encryptionKey?: IKryptos;
  source: IMongoSource;
  target: Constructor<KryptosDB>;
};

export const createAmphoraEntityWorker = (options: Options): LindormWorkerConfig => ({
  alias: "AmphoraEntityWorker",
  interval: options.interval ?? "3m",
  listeners: options.listeners ?? [],
  randomize: options.randomize,
  retry: options.retry,
  callback: async (ctx): Promise<void> => {
    await options.amphora.refresh();

    const aes = options.encryptionKey
      ? new AesKit({ kryptos: options.encryptionKey })
      : undefined;

    const repository = options.source.repository(options.target, {
      logger: ctx.logger,
    });

    const existing = await repository.find();

    const keys: Array<IKryptos> = [];

    for (const data of existing) {
      if (aes && data.privateKey && AesKit.isAesTokenised(data.privateKey)) {
        data.privateKey = aes.decrypt<string>(data.privateKey);
      }

      keys.push(KryptosKit.from.db(data));
    }

    options.amphora.add(keys);
  },
});
