import { mongoConnection } from "../../instance";
import { AccountRepository, BrowserLinkRepository } from "../../infrastructure";
import { logger } from "../logger";

interface TestRepository {
  accountRepository: AccountRepository;
  browserLinkRepository: BrowserLinkRepository;
}

export const getTestRepository = (): TestRepository => ({
  accountRepository: new AccountRepository({ connection: mongoConnection, logger }),
  browserLinkRepository: new BrowserLinkRepository({ connection: mongoConnection, logger }),
});
