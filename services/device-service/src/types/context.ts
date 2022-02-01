import { Axios } from "@lindorm-io/axios";
import { ChallengeSession, DeviceLink, EnrolmentSession, RdcSession } from "../entity";
import { IssuerVerifyData, TokenIssuer } from "@lindorm-io/jwt";
import { KeyPair, Keystore } from "@lindorm-io/key-pair";
import { KeyPairCache, KeyPairRepository } from "@lindorm-io/koa-keystore";
import { KoaContext, RecordAny, RecordNever } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { VerifiedChallengeConfirmationToken } from "./token";
import {
  ChallengeSessionCache,
  DeviceLinkRepository,
  EnrolmentSessionCache,
  RdcSessionCache,
} from "../infrastructure";

export interface Context<Body = Record<string, any>> extends KoaContext<Body> {
  axios: {
    axiosClient: Axios;
    communicationClient: Axios;
    oauthClient: Axios;
  };
  cache: {
    challengeSessionCache: ChallengeSessionCache;
    rdcSessionCache: RdcSessionCache;
    enrolmentSessionCache: EnrolmentSessionCache;
    keyPairCache: KeyPairCache;
  };
  connection: {
    mongo: MongoConnection;
    redis: RedisConnection;
  };
  entity: {
    challengeSession: ChallengeSession;
    deviceLink: DeviceLink;
    rdcSession: RdcSession;
    enrolmentSession: EnrolmentSession;
  };
  jwt: TokenIssuer;
  keys: Array<KeyPair>;
  keystore: Keystore;
  repository: {
    deviceLinkRepository: DeviceLinkRepository;
    keyPairRepository: KeyPairRepository;
  };
  token: {
    bearerToken: IssuerVerifyData<RecordNever, RecordNever>;
    challengeConfirmationToken: VerifiedChallengeConfirmationToken;
    challengeSessionToken: IssuerVerifyData<RecordNever, RecordNever>;
    rdcSessionToken: IssuerVerifyData<RecordAny, RecordAny>;
    enrolmentSessionToken: IssuerVerifyData<RecordNever, RecordNever>;
  };
}
