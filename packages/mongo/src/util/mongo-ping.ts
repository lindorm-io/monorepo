import { MongoConnection } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";

export const mongoPing = async (connection: MongoConnection, logger: Logger): Promise<boolean> => {
  try {
    await connection.client().connect();

    logger.info("Mongo Ping Success");

    return true;
  } catch (err: any) {
    logger.error("Mongo Ping Failure", err);

    return false;
  }
};
