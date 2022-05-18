import { MongoConnection } from "../infrastructure";
import { QueryCallback } from "../types";
import { Logger } from "@lindorm-io/winston";

export const mongoQuery = async (
  connection: MongoConnection,
  logger: Logger,
  callback: QueryCallback,
): Promise<void> => {
  try {
    await connection.waitForConnection();

    await callback({ connection, logger });

    logger.debug("mongo query success");
  } catch (err: any) {
    logger.error("mongo query failure", err);
  }
};
