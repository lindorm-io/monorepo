import { mongoConnection } from "../../instance";
import { winston } from "../../logger";
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

export const getTestRepository = async (): Promise<TestRepository> => {
  await mongoConnection.waitForConnection();
  const db = mongoConnection.database();
  const logger = winston;

  return {
    browserSessionRepository: new BrowserSessionRepository({ db, logger }),
    clientRepository: new ClientRepository({ db, logger }),
    consentSessionRepository: new ConsentSessionRepository({ db, logger }),
    refreshSessionRepository: new RefreshSessionRepository({ db, logger }),
  };
};
