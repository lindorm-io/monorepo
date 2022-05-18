import { mongoConnection } from "../../instance";
import { logger } from "../logger";
import {
  DisplayNameRepository,
  EmailRepository,
  IdentityRepository,
  ExternalIdentifierRepository,
  PhoneNumberRepository,
} from "../../infrastructure";

interface TestRepository {
  displayNameRepository: DisplayNameRepository;
  emailRepository: EmailRepository;
  identityRepository: IdentityRepository;
  externalIdentifierRepository: ExternalIdentifierRepository;
  phoneNumberRepository: PhoneNumberRepository;
}

export const getTestRepository = (): TestRepository => ({
  displayNameRepository: new DisplayNameRepository({ connection: mongoConnection, logger }),
  emailRepository: new EmailRepository({ connection: mongoConnection, logger }),
  identityRepository: new IdentityRepository({ connection: mongoConnection, logger }),
  externalIdentifierRepository: new ExternalIdentifierRepository({
    connection: mongoConnection,
    logger,
  }),
  phoneNumberRepository: new PhoneNumberRepository({ connection: mongoConnection, logger }),
});
