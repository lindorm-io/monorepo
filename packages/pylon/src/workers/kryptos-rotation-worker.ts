import type { IAmphora } from "@lindorm/amphora";
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
> & {
  // Per-key lifetime. Falls back to the worker-level `expiry` (default 6mo) when
  // unset. NOTE: the unit for months is `mo`/`month` — `m` means MINUTES.
  // Rotation overlap is always half the key's own expiry.
  expiry?: ReadableTime;
};

type Options = CreateLindormWorkerOptions & {
  expiry?: ReadableTime;
  keys?: Array<KeyOption>;
  rootCaKey?: IKryptos;
  logger: ILogger;
  db: IProteusSource;
  target?: Constructor<KryptosDB>;
  // When provided, freshly-minted keys are added to the vault immediately — so
  // the rotating instance serves them (JWKS, cookie/session) without waiting for
  // the amphora-entity sync worker (which exists to propagate OTHER instances'
  // keys). Without this, a fresh boot has an empty JWKS until the next sync.
  amphora?: IAmphora;
};

export const createKryptosRotationWorker = (options: Options): LindormWorker => {
  const keys: Array<KeyOption> = [
    // Cookie + session keys are long-lived (1y) — they never leave the server
    // and rotating them churns live sessions, so a longer lifetime is safer.
    { algorithm: "dir", hidden: true, purpose: "cookie", expiry: "1y" },
    { algorithm: "HS256", hidden: true, purpose: "cookie", expiry: "1y" },
    {
      algorithm: "EdDSA",
      curve: "Ed448",
      hidden: true,
      purpose: "session",
      expiry: "1y",
    },
    {
      algorithm: "ECDH-ES",
      curve: "X448",
      hidden: true,
      purpose: "session",
      expiry: "1y",
    },
    // Published token keys rotate faster (6m) — smaller blast radius if leaked,
    // and RPs re-fetch JWKS.
    ...(options.keys ?? [
      { algorithm: "EdDSA", curve: "Ed25519", purpose: "token", expiry: "6mo" },
      { algorithm: "ECDH-ES+A256GCMKW", curve: "X448", purpose: "token", expiry: "6mo" },
    ]),
  ];

  // Fallback lifetime for any key that doesn't set its own `expiry`.
  const defaultExpiry = options.expiry ?? "6mo";

  return new LindormWorker({
    alias: "KryptosRotationWorker",
    interval: options.interval ?? "1d",
    listeners: options.listeners ?? [],
    jitter: options.jitter,
    retry: options.retry,
    logger: options.logger,
    callback: async (ctx): Promise<void> => {
      const target = options.target ?? (await import("../entities/Kryptos.js")).Kryptos;
      const repository = options.db.repository(target);
      const existing = await repository.find();

      const notBefore = new Date();

      let generated = 0;
      const minted: Array<IKryptos> = [];

      for (const opts of keys) {
        const keyExpiry: ReadableTime = opts.expiry ?? defaultExpiry;
        const rotation: ReadableTime = ms(ms(keyExpiry) / 2);
        const expiresAt = add(notBefore, duration(keyExpiry));

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
          const kryptos = KryptosKit.generate.auto({
            algorithm: opts.algorithm,
            certificate,
            curve: opts.curve,
            hidden: opts.hidden,
            expiresAt,
            notBefore,
            purpose: opts.purpose,
          });

          // Log `use` too — a purpose has both a sig and an enc key, so
          // { algorithm, purpose } alone reads ambiguously across the pair.
          ctx.logger.debug("No existing keys found, generating initial key", {
            algorithm: opts.algorithm,
            curve: opts.curve,
            purpose: opts.purpose,
            use: kryptos.use,
          });

          const entity = repository.create(kryptos.toDB());
          const inserted = await repository.insert(entity);

          existingKeys.push(inserted);
          minted.push(kryptos);
          generated++;
        }

        if (existingKeys.length === 1) {
          const [existingKey] = existingKeys;

          const kryptos = KryptosKit.generate.auto({
            algorithm: opts.algorithm,
            certificate,
            curve: opts.curve,
            hidden: opts.hidden,
            expiresAt: add(existingKey.expiresAt, duration(rotation)),
            notBefore: sub(existingKey.expiresAt, duration(rotation)),
            purpose: opts.purpose,
          });

          // Log `use` too — a purpose has both a sig and an enc key, so
          // { algorithm, purpose } alone reads ambiguously across the pair.
          ctx.logger.debug("Only one key found, generating rotation key", {
            algorithm: opts.algorithm,
            curve: opts.curve,
            purpose: opts.purpose,
            use: kryptos.use,
          });

          const entity = repository.create(kryptos.toDB());
          await repository.insert(entity);
          minted.push(kryptos);
          generated++;
        }
      }

      // Serve freshly-minted keys immediately — don't wait for the amphora-entity
      // sync worker (which is there to pick up OTHER instances' keys).
      if (minted.length && options.amphora) {
        options.amphora.add(minted);
      }

      ctx.logger.verbose("Kryptos rotation complete", {
        checked: keys.length,
        existing: existing.length,
        generated,
      });
    },
  });
};
