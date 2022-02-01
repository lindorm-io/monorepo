import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairRepository } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { add, sub } from "date-fns";
import { generateKeyPair, KeyType, NamedCurve } from "@lindorm-io/key-pair";
import { stringToDurationObject, stringToMilliseconds } from "@lindorm-io/core";

interface Options {
  keyType?: KeyType;
  mongoConnection: MongoConnection;
  namedCurve?: NamedCurve;
  passphrase?: string;
  rotationInterval?: string;
  winston: Logger;
  workerInterval?: string;
}

export const keyPairRotationWorker = (options: Options): IntervalWorker => {
  const {
    keyType = KeyType.EC,
    mongoConnection,
    namedCurve = NamedCurve.P521,
    passphrase = "",
    rotationInterval = "90 days",
    winston,
    workerInterval = "1 days",
  } = options;

  const logger = winston.createChildLogger(["keyPairRotationWorker"]);

  return new IntervalWorker({
    callback: async (): Promise<void> => {
      await mongoConnection.waitForConnection();

      const repository = new KeyPairRepository({
        db: mongoConnection.database(),
        logger,
      });

      const keys = await repository.findMany({ expires: { $gt: new Date() } });

      if (!keys.length) {
        logger.warn("No valid KeyPair found", { keys });

        const keyPair = await generateKeyPair({
          namedCurve,
          passphrase,
          type: keyType,
        });

        keyPair.expires = add(new Date(), stringToDurationObject(rotationInterval));

        logger.info("Generating new KeyPair", {
          id: keyPair.id,
          expires: keyPair.expires,
          namedCurve: keyPair.namedCurve,
          type: keyPair.type,
        });

        await repository.create(keyPair);
      }

      if (keys.length === 1) {
        const next = keys[0];

        if (next.expires) {
          const keyPair = await generateKeyPair({
            namedCurve,
            passphrase,
            type: keyType,
          });

          keyPair.allowed = sub(next.expires, stringToDurationObject("2 days"));
          keyPair.expires = add(next.expires, stringToDurationObject(rotationInterval));

          logger.info("");

          await repository.create(keyPair);
        } else {
          logger.warn("KeyPair will never expire", next);
        }
      }
    },
    logger,
    time: stringToMilliseconds(workerInterval),
  });
};
