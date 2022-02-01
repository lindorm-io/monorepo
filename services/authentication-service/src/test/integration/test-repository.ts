import { mongoConnection } from "../../instance";
import { winston } from "../../logger";
import { AccountRepository, BrowserLinkRepository } from "../../infrastructure";

interface TestRepository {
  accountRepository: AccountRepository;
  browserLinkRepository: BrowserLinkRepository;
}

export const getTestRepository = async (): Promise<TestRepository> => {
  await mongoConnection.waitForConnection();
  const db = mongoConnection.database();
  const logger = winston;

  return {
    accountRepository: new AccountRepository({ db, logger }),
    browserLinkRepository: new BrowserLinkRepository({ db, logger }),
  };
};
