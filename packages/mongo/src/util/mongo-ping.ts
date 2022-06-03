import { MongoConnection } from "../infrastructure";
import { ILogger } from "@lindorm-io/winston";

export const mongoPing = async (connection: MongoConnection, logger: ILogger): Promise<boolean> => {
  try {
    await connection.client().connect();

    logger.debug("mongo ping success");

    return true;
  } catch (err: any) {
    logger.error("mongo ping failure", err);

    return false;
  }
};
