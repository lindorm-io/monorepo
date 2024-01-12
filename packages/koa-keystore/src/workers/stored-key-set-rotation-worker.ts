import { Logger } from "@lindorm-io/core-logger";
import { GenerateOptions, WebKeySet } from "@lindorm-io/jwk";
import { StoredKeySet } from "@lindorm-io/keystore";
import { IntervalWorker } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { ReadableTime, ms, readableDuration } from "@lindorm-io/readable-time";
import { RetryOptions } from "@lindorm-io/retry";
import { add } from "date-fns";
import { StoredKeySetMongoRepository } from "../infrastructure";

type Options = {
  encOptions?: GenerateOptions;
  expiry?: ReadableTime;
  jwkUri?: string;
  logger: Logger;
  mongoConnection: MongoConnection;
  retry?: Partial<RetryOptions>;
  rotationInterval?: ReadableTime;
  sigOptions?: GenerateOptions;
  workerInterval?: ReadableTime;
};

export const storedKeySetRotationWorker = (options: Options): IntervalWorker => {
  const {
    expiry = "120 days",
    jwkUri,
    mongoConnection,
    retry,
    rotationInterval = "30 days",
    workerInterval = "1 days",
  } = options;

  const sig: GenerateOptions = options.sigOptions
    ? options.sigOptions
    : { algorithm: "ES512", curve: "P-521", type: "EC", use: "sig" };

  const enc: GenerateOptions = options.encOptions
    ? options.encOptions
    : { algorithm: "RS512", modulus: 2, type: "RSA", use: "enc" };

  const logger = options.logger.createChildLogger(["storedKeySetRotationWorker"]);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const repository = new StoredKeySetMongoRepository(mongoConnection, logger);

        const foundKeys = await repository.findMany({
          expires: { $gt: new Date() },
        });

        const encKeys = foundKeys.filter((key) => key.webKeySet.use === "enc");
        const sigKeys = foundKeys.filter((key) => key.webKeySet.use === "sig");

        const now = new Date();

        if (!encKeys.length) {
          logger.warn("no valid storedKeySet found", { keys: encKeys });

          const expiresAt = add(now, readableDuration(expiry));
          const notBefore = now;
          const keySet = await WebKeySet.generate({ ...enc, expiresAt, jwkUri, notBefore });

          logger.verbose("Adding new KeySet to repository", {
            id: keySet.id,
            expiresAt: keySet.expiresAt,
            notBefore: keySet.notBefore,
            type: keySet.type,
          });

          await repository.create(new StoredKeySet(keySet));
        }

        if (!sigKeys.length) {
          logger.warn("no valid storedKeySet found", { keys: sigKeys });

          const expiresAt = add(now, readableDuration(expiry));
          const notBefore = now;
          const keySet = await WebKeySet.generate({ ...sig, expiresAt, jwkUri, notBefore });

          logger.verbose("Adding new KeySet to repository", {
            id: keySet.id,
            expiresAt: keySet.expiresAt,
            notBefore: keySet.notBefore,
            type: keySet.type,
          });

          await repository.create(new StoredKeySet(keySet));
        }

        if (encKeys.length < 2) {
          logger.warn("only one key pair found", { keys: encKeys });

          const notBefore = add(now, readableDuration(rotationInterval));
          const expiresAt = add(notBefore, readableDuration(expiry));
          const keySet = await WebKeySet.generate({ ...enc, expiresAt, jwkUri, notBefore });

          logger.verbose("Adding next KeySet to repository", {
            id: keySet.id,
            expiresAt: keySet.expiresAt,
            notBefore: keySet.notBefore,
            type: keySet.type,
          });

          await repository.create(new StoredKeySet(keySet));
        }

        if (sigKeys.length < 2) {
          logger.warn("only one key pair found", { keys: sigKeys });

          const notBefore = add(now, readableDuration(rotationInterval));
          const expiresAt = add(notBefore, readableDuration(expiry));
          const keySet = await WebKeySet.generate({ ...sig, expiresAt, jwkUri, notBefore });

          logger.verbose("Adding next KeySet to repository", {
            id: keySet.id,
            expiresAt: keySet.expiresAt,
            notBefore: keySet.notBefore,
            type: keySet.type,
          });

          await repository.create(new StoredKeySet(keySet));
        }
      },
      retry,
      time: ms(workerInterval),
    },
    logger,
  );
};
