import { Logger } from "@lindorm-io/core-logger";
import { StringTimeValue, stringDuration, stringMs } from "@lindorm-io/expiry";
import { KeyType, NamedCurve, generateKeyPair } from "@lindorm-io/key-pair";
import { IntervalWorker } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { RetryOptions } from "@lindorm-io/retry";
import { add } from "date-fns";
import { KeyPairMongoRepository } from "../infrastructure";

type Options = {
  keyExpiry?: StringTimeValue;
  keyType?: KeyType;
  mongoConnection: MongoConnection;
  namedCurve?: NamedCurve;
  origin?: string;
  passphrase?: string;
  retry?: Partial<RetryOptions>;
  rotationInterval?: StringTimeValue;
  logger: Logger;
  workerInterval?: StringTimeValue;
};

export const keyPairRotationWorker = (options: Options): IntervalWorker => {
  const {
    keyExpiry = "120 days",
    keyType = KeyType.EC,
    mongoConnection,
    namedCurve = NamedCurve.P521,
    origin,
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
            origin,
            passphrase,
            type: keyType,
          });

          keyPair.allowed = now;
          keyPair.expires = add(now, stringDuration(keyExpiry));

          logger.verbose("Adding KeyPair to repository", {
            id: keyPair.id,
            allowed: keyPair.allowed,
            expires: keyPair.expires,
            type: keyPair.type,
          });

          await repository.create(keyPair);
        }

        if (keys.length < 2) {
          const keyPair = await generateKeyPair({
            namedCurve,
            origin,
            passphrase,
            type: keyType,
          });

          keyPair.allowed = add(now, stringDuration(rotationInterval));
          keyPair.expires = add(keyPair.allowed, stringDuration(keyExpiry));

          logger.verbose("Adding KeyPair to repository", {
            id: keyPair.id,
            allowed: keyPair.allowed,
            expires: keyPair.expires,
            type: keyPair.type,
          });

          await repository.create(keyPair);
        }
      },
      retry,
      time: stringMs(workerInterval),
    },
    logger,
  );
};
