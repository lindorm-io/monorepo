import { mongoConnection } from "../../instance";
import { logger } from "../logger";
import {
  ClientRepository,
  ConsentSessionRepository,
  BrowserSessionRepository,
  RefreshSessionRepository,
} from "../../infrastructure";

interface TestRepository {
  browserSessionRepository: BrowserSessionRepository;
  clientRepository: ClientRepository;
  consentSessionRepository: ConsentSessionRepository;
  refreshSessionRepository: RefreshSessionRepository;
}

export const getTestRepository = (): TestRepository => ({
  browserSessionRepository: new BrowserSessionRepository({ connection: mongoConnection, logger }),
  clientRepository: new ClientRepository({ connection: mongoConnection, logger }),
  consentSessionRepository: new ConsentSessionRepository({ connection: mongoConnection, logger }),
  refreshSessionRepository: new RefreshSessionRepository({ connection: mongoConnection, logger }),
});
