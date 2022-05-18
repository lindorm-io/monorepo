import { DeviceLinkRepository } from "../../infrastructure";
import { mongoConnection } from "../../instance";
import { logger } from "../logger";

interface TestRepository {
  deviceLinkRepository: DeviceLinkRepository;
}

export const getTestRepository = (): TestRepository => ({
  deviceLinkRepository: new DeviceLinkRepository({ connection: mongoConnection, logger }),
});
