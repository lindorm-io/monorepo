import { AesKit } from "@lindorm/aes";
import { add, duration, ms, ReadableTime, sub } from "@lindorm/date";
import {
  IKryptos,
  KryptosAlgorithm,
  KryptosDB,
  KryptosKit,
  KryptosPurpose,
} from "@lindorm/kryptos";
import { IMongoSource } from "@lindorm/mongo";
import { Constructor } from "@lindorm/types";
import { CreateLindormWorkerOptions, LindormWorkerConfig } from "@lindorm/worker";

type KeyOption = {
  algorithm: KryptosAlgorithm;
  purpose: KryptosPurpose | null;
};

type Options = CreateLindormWorkerOptions & {
  encryptionKey?: IKryptos;
  expiry?: ReadableTime;
  keys?: Array<KeyOption>;
  source: IMongoSource;
  target: Constructor<KryptosDB>;
};

export const createKryptosRotationWorker = (options: Options): LindormWorkerConfig => ({
  alias: "KryptosRotationWorker",
  interval: options.interval ?? "1d",
  listeners: options.listeners ?? [],
  randomize: options.randomize,
  retry: options.retry,
  callback: async (ctx): Promise<void> => {
    const keys = options.keys ?? [
      // cookie signature & encryption
      { algorithm: "dir", purpose: "cookie" },
      { algorithm: "HS256", purpose: "cookie" },

      // session signature & encryption
      { algorithm: "EdDSA", purpose: "session" },
      { algorithm: "ECDH-ES", purpose: "session" },

      // token signature & encryption
      { algorithm: "ES512", purpose: "token" },
      { algorithm: "ECDH-ES+A128GCMKW", purpose: "token" },
    ];

    const aes = options.encryptionKey
      ? new AesKit({ kryptos: options.encryptionKey })
      : undefined;

    const repository = options.source.repository(options.target, {
      logger: ctx.logger,
    });

    const existing = await repository.find();

    const expiry = options.expiry ?? "6m";
    const rotation: ReadableTime = ms(ms(expiry) / 2);

    const notBefore = new Date();
    const expiresAt = add(notBefore, duration(expiry));

    for (const opts of keys) {
      const existingKeys = existing.filter(
        (k) => k.algorithm === opts.algorithm && k.purpose === opts.purpose,
      );

      if (existingKeys.length === 0) {
        ctx.logger.debug("No existing keys found", {
          algorithm: opts.algorithm,
          purpose: opts.purpose,
        });

        const kryptos = KryptosKit.generate.auto({
          algorithm: opts.algorithm,
          expiresAt,
          notBefore,
          purpose: opts.purpose,
        });

        const data = kryptos.toDB();

        if (aes && data.privateKey) {
          data.privateKey = aes.encrypt(data.privateKey, "tokenised");
        }

        const entity = repository.create(data);
        const inserted = await repository.insert(entity);

        existingKeys.push(inserted);
      }

      if (existingKeys.length === 1) {
        ctx.logger.debug("Only one existing key found", {
          algorithm: opts.algorithm,
          purpose: opts.purpose,
        });

        const [existingKey] = existingKeys;

        const kryptos = KryptosKit.generate.auto({
          algorithm: opts.algorithm,
          expiresAt: add(existingKey.expiresAt ?? expiresAt, duration(rotation)),
          notBefore: sub(existingKey.expiresAt ?? expiresAt, duration(rotation)),
          purpose: opts.purpose,
        });

        const data = kryptos.toDB();

        if (aes && data.privateKey) {
          data.privateKey = aes.encrypt(data.privateKey, "tokenised");
        }

        const entity = repository.create(data);
        await repository.insert(entity);
      }
    }
  },
});
