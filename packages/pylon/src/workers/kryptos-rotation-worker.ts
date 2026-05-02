import { add, duration, isAfter, ms, type ReadableTime, sub } from "@lindorm/date";
import {
  type IKryptos,
  type KryptosAuto,
  type KryptosDB,
  KryptosKit,
} from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import type { Constructor } from "@lindorm/types";
import { type CreateLindormWorkerOptions, LindormWorker } from "@lindorm/worker";

type KeyOption = Pick<
  KryptosAuto,
  "algorithm" | "curve" | "encryption" | "hidden" | "purpose"
>;

type Options = CreateLindormWorkerOptions & {
  expiry?: ReadableTime;
  keys?: Array<KeyOption>;
  rootCaKey?: IKryptos;
  logger: ILogger;
  proteus: IProteusSource;
  target?: Constructor<KryptosDB>;
};

export const createKryptosRotationWorker = (options: Options): LindormWorker => {
  const keys: Array<KeyOption> = [
    { algorithm: "dir", hidden: true, purpose: "cookie" },
    { algorithm: "HS256", hidden: true, purpose: "cookie" },
    { algorithm: "EdDSA", curve: "Ed448", hidden: true, purpose: "session" },
    { algorithm: "ECDH-ES", curve: "X448", hidden: true, purpose: "session" },
    ...(options.keys ?? [
      { algorithm: "EdDSA", curve: "Ed25519", purpose: "token" },
      { algorithm: "ECDH-ES+A256GCMKW", curve: "X448", purpose: "token" },
    ]),
  ];

  const expiry = options.expiry ?? "6m";

  return new LindormWorker({
    alias: "KryptosRotationWorker",
    interval: options.interval ?? "1d",
    listeners: options.listeners ?? [],
    jitter: options.jitter,
    retry: options.retry,
    logger: options.logger,
    callback: async (ctx): Promise<void> => {
      const target = options.target ?? (await import("../entities/Kryptos.js")).Kryptos;
      const repository = options.proteus.repository(target);
      const existing = await repository.find();

      const rotation: ReadableTime = ms(ms(expiry) / 2);

      const notBefore = new Date();
      const expiresAt = add(notBefore, duration(expiry));

      let generated = 0;

      for (const opts of keys) {
        const existingKeys = existing.filter(
          (k) =>
            k.algorithm === opts.algorithm &&
            k.purpose === opts.purpose &&
            (opts.curve == null || k.curve === opts.curve) &&
            isAfter(k.expiresAt, notBefore),
        );

        const certificate =
          options.rootCaKey &&
          !opts.hidden &&
          KryptosKit.getTypeForAlgorithm(opts.algorithm) !== "oct"
            ? ({ mode: "ca-signed", ca: options.rootCaKey } as const)
            : undefined;

        if (existingKeys.length === 0) {
          ctx.logger.debug("No existing keys found, generating initial key", {
            algorithm: opts.algorithm,
            curve: opts.curve,
            purpose: opts.purpose,
          });

          const kryptos = KryptosKit.generate.auto({
            algorithm: opts.algorithm,
            certificate,
            curve: opts.curve,
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
            curve: opts.curve,
            purpose: opts.purpose,
          });

          const [existingKey] = existingKeys;

          const kryptos = KryptosKit.generate.auto({
            algorithm: opts.algorithm,
            certificate,
            curve: opts.curve,
            expiresAt: add(existingKey.expiresAt, duration(rotation)),
            notBefore: sub(existingKey.expiresAt, duration(rotation)),
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
};
