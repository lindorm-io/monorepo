import { getTestCache } from "./test-cache";
import { getTestKeyPairEC } from "./test-key-pair";
import { getTestRepository } from "./test-repository";
import {
  ChallengeSessionCache,
  DeviceLinkRepository,
  EnrolmentSessionCache,
  RdcSessionCache,
} from "../../infrastructure";

export let TEST_CHALLENGE_SESSION_CACHE: ChallengeSessionCache;
export let TEST_ENROLMENT_SESSION_CACHE: EnrolmentSessionCache;
export let TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE: RdcSessionCache;

export let TEST_DEVICE_REPOSITORY: DeviceLinkRepository;

export const setupIntegration = async (): Promise<void> => {
  const { challengeSessionCache, enrolmentSessionCache, rdcSessionCache, keyPairCache } =
    getTestCache();
  const { deviceLinkRepository } = getTestRepository();

  TEST_CHALLENGE_SESSION_CACHE = challengeSessionCache;
  TEST_ENROLMENT_SESSION_CACHE = enrolmentSessionCache;
  TEST_REMOTE_DEVICE_CHALLENGE_SESSION_CACHE = rdcSessionCache;

  TEST_DEVICE_REPOSITORY = deviceLinkRepository;

  await keyPairCache.create(getTestKeyPairEC());
};
