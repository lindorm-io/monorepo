import { getTestCache } from "./test-cache";
import { getTestKeyPairEC } from "./test-key-pair";
import { getTestRepository } from "./test-repository";
import {
  ConnectSessionCache,
  DisplayNameRepository,
  EmailRepository,
  IdentityRepository,
  ExternalIdentifierRepository,
  PhoneNumberRepository,
} from "../../infrastructure";

export let TEST_CONNECT_SESSION_CACHE: ConnectSessionCache;

export let TEST_DISPLAY_NAME_REPOSITORY: DisplayNameRepository;
export let TEST_EMAIL_REPOSITORY: EmailRepository;
export let TEST_IDENTITY_REPOSITORY: IdentityRepository;
export let TEST_EXTERNAL_IDENTIFIER_REPOSITORY: ExternalIdentifierRepository;
export let TEST_PHONE_NUMBER_REPOSITORY: PhoneNumberRepository;

export const setupIntegration = async (): Promise<void> => {
  const { connectSessionCache, keyPairCache } = await getTestCache();
  const {
    displayNameRepository,
    emailRepository,
    identityRepository,
    externalIdentifierRepository,
    phoneNumberRepository,
  } = await getTestRepository();

  TEST_CONNECT_SESSION_CACHE = connectSessionCache;

  TEST_DISPLAY_NAME_REPOSITORY = displayNameRepository;
  TEST_EMAIL_REPOSITORY = emailRepository;
  TEST_IDENTITY_REPOSITORY = identityRepository;
  TEST_EXTERNAL_IDENTIFIER_REPOSITORY = externalIdentifierRepository;
  TEST_PHONE_NUMBER_REPOSITORY = phoneNumberRepository;

  await keyPairCache.create(getTestKeyPairEC());
};
