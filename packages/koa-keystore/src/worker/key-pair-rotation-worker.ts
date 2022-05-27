import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairRepository } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { add } from "date-fns";
import { generateKeyPair, KeyType, NamedCurve } from "@lindorm-io/key-pair";
import { stringToDurationObject, stringToMilliseconds } from "@lindorm-io/core";

interface Options {
  keyExpiry?: string;
  keyType?: KeyType;
  mongoConnection: MongoConnection;
  namedCurve?: NamedCurve;
  passphrase?: string;
  retry?: number;
  rotationInterval?: string;
  winston: Logger;
  workerInterval?: string;
}

export const keyPairRotationWorker = (options: Options): IntervalWorker => {
  const {
    keyExpiry = "120 days",
    keyType = KeyType.EC,
    mongoConnection,
    namedCurve = NamedCurve.P521,
    passphrase = "",
    retry = 3,
    rotationInterval = "30 days",
    winston,
    workerInterval = "1 days",
  } = options;

  const logger = winston.createChildLogger(["keyPairRotationWorker"]);

  return new IntervalWorker({
    callback: async (): Promise<void> => {
      const repository = new KeyPairRepository({
        connection: mongoConnection,
        logger,
      });

      const keys = await repository.findMany({ expires: { $gt: new Date() }, type: keyType });
      const now = new Date();

      if (!keys.length) {
        logger.warn("no valid keypair found", { keys });

        const keyPair = await generateKeyPair({
          namedCurve,
          passphrase,
          type: keyType,
        });

        keyPair.allowed = now;
        keyPair.expires = add(now, stringToDurationObject(keyExpiry));

        logger.debug("Adding KeyPair to repository", {
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
          passphrase,
          type: keyType,
        });

        keyPair.allowed = add(now, stringToDurationObject(rotationInterval));
        keyPair.expires = add(keyPair.allowed, stringToDurationObject(keyExpiry));

        logger.debug("Adding KeyPair to repository", {
          id: keyPair.id,
          allowed: keyPair.allowed,
          expires: keyPair.expires,
          type: keyPair.type,
        });

        await repository.create(keyPair);
      }
    },
    logger,
    retry,
    time: stringToMilliseconds(workerInterval),
  });
};
