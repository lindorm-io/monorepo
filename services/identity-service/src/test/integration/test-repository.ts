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

export const getTestRepository = async (): Promise<TestRepository> => {
  await mongoConnection.waitForConnection();
  const db = mongoConnection.database();

  return {
    displayNameRepository: new DisplayNameRepository({ db, logger }),
    emailRepository: new EmailRepository({ db, logger }),
    identityRepository: new IdentityRepository({ db, logger }),
    externalIdentifierRepository: new ExternalIdentifierRepository({ db, logger }),
    phoneNumberRepository: new PhoneNumberRepository({ db, logger }),
  };
};
