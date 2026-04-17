import { add, duration, ms, ReadableTime, sub } from "@lindorm/date";
import { KryptosAlgorithm, KryptosDB, KryptosKit } from "@lindorm/kryptos";
import { IProteusSource } from "@lindorm/proteus";
import { Constructor } from "@lindorm/types";
import { CreateLindormWorkerOptions, LindormWorkerConfig } from "@lindorm/worker";
import { Kryptos } from "../entities/Kryptos";

type KeyOption = {
  algorithm: KryptosAlgorithm;
  purpose: string | null;
};

type Options = CreateLindormWorkerOptions & {
  expiry?: ReadableTime;
  keys?: Array<KeyOption>;
  proteus: IProteusSource;
  target?: Constructor<KryptosDB>;
};

export const createKryptosRotationWorker = (options: Options): LindormWorkerConfig => ({
  alias: "KryptosRotationWorker",
  interval: options.interval ?? "1d",
  listeners: options.listeners ?? [],
  jitter: options.jitter,
  retry: options.retry,
  callback: async (ctx): Promise<void> => {
    const keys = options.keys ?? [
      { algorithm: "dir", purpose: "cookie" },
      { algorithm: "HS256", purpose: "cookie" },
      { algorithm: "EdDSA", purpose: "session" },
      { algorithm: "ECDH-ES", purpose: "session" },
      { algorithm: "ES512", purpose: "token" },
      { algorithm: "ECDH-ES+A128GCMKW", purpose: "token" },
    ];

    const repository = options.proteus.repository(options.target ?? Kryptos);
    const existing = await repository.find();

    const expiry = options.expiry ?? "6m";
    const rotation: ReadableTime = ms(ms(expiry) / 2);

    const notBefore = new Date();
    const expiresAt = add(notBefore, duration(expiry));

    let generated = 0;

    for (const opts of keys) {
      const existingKeys = existing.filter(
        (k) => k.algorithm === opts.algorithm && k.purpose === opts.purpose,
      );

      if (existingKeys.length === 0) {
        ctx.logger.debug("No existing keys found, generating initial key", {
          algorithm: opts.algorithm,
          purpose: opts.purpose,
        });

        const kryptos = KryptosKit.generate.auto({
          algorithm: opts.algorithm,
          expiresAt,
          notBefore,
          purpose: opts.purpose,
        });

        const entity = repository.create(kryptos.toDB());
        const inserted = await repository.insert(entity);

        existingKeys.push(inserted);
        generated++;
      }

      if (existingKeys.length === 1) {
        ctx.logger.debug("Only one key found, generating rotation key", {
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

        const entity = repository.create(kryptos.toDB());
        await repository.insert(entity);
        generated++;
      }
    }

    ctx.logger.info("Kryptos rotation complete", {
      checked: keys.length,
      existing: existing.length,
      generated,
    });
  },
});
