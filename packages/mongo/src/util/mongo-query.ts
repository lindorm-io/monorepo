import { Logger } from "@lindorm-io/core-logger";
import { MongoConnection } from "../connection";
import { QueryCallback } from "../types";

export const mongoQuery = async (
  connection: MongoConnection,
  logger: Logger,
  callback: QueryCallback,
): Promise<void> => {
  try {
    await connection.connect();

    await callback({ connection, logger });

    logger.debug("mongo query success");
  } catch (err: any) {
    logger.error("mongo query failure", err);
  }
};
