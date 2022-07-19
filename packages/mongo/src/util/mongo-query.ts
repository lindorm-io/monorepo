import { ILogger } from "@lindorm-io/winston";
import { MongoConnection } from "../infrastructure";
import { QueryCallback } from "../types";

export const mongoQuery = async (
  connection: MongoConnection,
  logger: ILogger,
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
