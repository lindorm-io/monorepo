import { Expiry } from "@lindorm/date";
import { Dict } from "@lindorm/types";
import {
  AegisProfile,
  ConfirmationClaim,
  ExtendedClaims,
  LindormClaims,
  OidcClaims,
  StdClaims,
} from "../claims";
import { TokenEncryptOrSignOptions } from "../header";

export type SignJwtContent<C extends Dict = Dict> = Omit<
  StdClaims,
  "expiresAt" | "issuedAt" | "issuer" | "tokenId"
> &
  Omit<OidcClaims, "accessTokenHash" | "codeHash" | "stateHash"> &
  LindormClaims &
  ExtendedClaims & {
    accessToken?: string;
    authCode?: string;
    authState?: string;
    claims?: C;
    confirmation?: ConfirmationClaim;
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
