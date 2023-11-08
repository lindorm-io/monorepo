import { Logger } from "@lindorm-io/core-logger";
import { KeyType, NamedCurve, generateKeyPair } from "@lindorm-io/key-pair";
import { IntervalWorker } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { ReadableTime, ms, readableDuration } from "@lindorm-io/readable-time";
import { RetryOptions } from "@lindorm-io/retry";
import { add } from "date-fns";
import { KeyPairMongoRepository } from "../infrastructure";

type Options = {
  keyExpiry?: ReadableTime;
  keyType?: KeyType;
  logger: Logger;
  mongoConnection: MongoConnection;
  namedCurve?: NamedCurve;
  originUri?: string;
  passphrase?: string;
  retry?: Partial<RetryOptions>;
  rotationInterval?: ReadableTime;
  workerInterval?: ReadableTime;
};

export const keyPairRotationWorker = (options: Options): IntervalWorker => {
  const {
    keyExpiry = "120 days",
    keyType = KeyType.EC,
    mongoConnection,
    namedCurve = NamedCurve.P521,
    originUri,
    passphrase = "",
    retry,
    rotationInterval = "30 days",
    workerInterval = "1 days",
  } = options;

  const logger = options.logger.createChildLogger(["keyPairRotationWorker"]);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const repository = new KeyPairMongoRepository(mongoConnection, logger);

        const keys = await repository.findMany({ expires: { $gt: new Date() }, type: keyType });
        const now = new Date();

        if (!keys.length) {
          logger.warn("no valid keypair found", { keys });

          const keyPair = await generateKeyPair({
            namedCurve,
            originUri,
            passphrase,
            type: keyType,
          });

          keyPair.notBefore = now;
          keyPair.expiresAt = add(now, readableDuration(keyExpiry));

          logger.verbose("Adding KeyPair to repository", {
            id: keyPair.id,
            expiresAt: keyPair.expiresAt,
            notBefore: keyPair.notBefore,
            type: keyPair.type,
          });

          await repository.create(keyPair);
        }

        if (keys.length < 2) {
          const keyPair = await generateKeyPair({
            namedCurve,
            originUri,
            passphrase,
            type: keyType,
          });

          keyPair.notBefore = add(now, readableDuration(rotationInterval));
          keyPair.expiresAt = add(keyPair.notBefore, readableDuration(keyExpiry));

          logger.verbose("Adding KeyPair to repository", {
            id: keyPair.id,
            expiresAt: keyPair.expiresAt,
            notBefore: keyPair.notBefore,
            type: keyPair.type,
          });

          await repository.create(keyPair);
        }
      },
      retry,
      time: ms(workerInterval),
    },
    logger,
  );
};
