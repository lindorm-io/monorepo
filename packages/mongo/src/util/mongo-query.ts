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

    await callback({ db: connection.database(), logger });

    logger.info("Mongo Query Success");
  } catch (err: any) {
    logger.error("Mongo Query Failure", err);
  }
};
