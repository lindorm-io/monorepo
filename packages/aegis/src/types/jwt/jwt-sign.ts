import { Expiry } from "@lindorm/date";
import { Dict } from "@lindorm/types";
import {
  AegisProfile,
  LindormClaims,
  OAuthClaims,
  OidcClaims,
  PopClaims,
  DelegationClaims,
  StdClaims,
} from "../claims";
import { TokenEncryptOrSignOptions } from "../header";

export type SignJwtContent<C extends Dict = Dict> = Omit<
  StdClaims,
  "expiresAt" | "issuedAt" | "issuer" | "tokenId"
> &
  Omit<OidcClaims, "accessTokenHash" | "codeHash" | "stateHash"> &
  PopClaims &
  DelegationClaims &
  OAuthClaims &
  LindormClaims & {
    accessToken?: string;
    authCode?: string;
    authState?: string;
    claims?: C;
    expires: Expiry;
    profile?: AegisProfile;
    subject: string;
    tokenType: string;
  };

export type SignJwtOptions = {
  accessTokenHash?: string;
  codeHash?: string;
  header?: TokenEncryptOrSignOptions;
  issuedAt?: Date;
  objectId?: string;
  stateHash?: string;
  tokenId?: string;
};

export type SignedJwt = {
  expiresAt: Date;
  expiresIn: number;
  expiresOn: number;
  objectId: string | undefined;
  token: string;
  tokenId: string;
};
