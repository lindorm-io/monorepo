import { MongoConnection } from "../connection";
import { Logger } from "@lindorm-io/core-logger";

export const mongoPing = async (connection: MongoConnection, logger: Logger): Promise<boolean> => {
  try {
    await connection.client.connect();

    logger.debug("mongo ping success");

    return true;
  } catch (err: any) {
    logger.error("mongo ping failure", err);

    return false;
  }
};
