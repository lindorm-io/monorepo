import { DeviceLinkRepository } from "../../infrastructure";
import { mongoConnection } from "../../instance";
import { winston } from "../../logger";

interface TestRepository {
  deviceLinkRepository: DeviceLinkRepository;
}

export const getTestRepository = async (): Promise<TestRepository> => {
  await mongoConnection.waitForConnection();
  const db = mongoConnection.database();
  const logger = winston;

  return {
    deviceLinkRepository: new DeviceLinkRepository({ db, logger }),
  };
};
