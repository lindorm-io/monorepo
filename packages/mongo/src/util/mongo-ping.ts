import { MongoConnection } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";

export const mongoPing = async (connection: MongoConnection, logger: Logger): Promise<boolean> => {
  try {
    await connection.client().connect();

    logger.verbose("mongo ping success");

    return true;
  } catch (err: any) {
    logger.error("mongo ping failure", err);

    return false;
  }
};
