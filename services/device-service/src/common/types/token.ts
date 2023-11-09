import { ChallengeStrategy, PSD2Factor } from "@lindorm-io/common-enums";
import { Dict } from "@lindorm-io/common-types";

export interface AuthenticationConfirmationTokenClaims {
  confirmedIdentifiers: Array<string>;
  country: string | null;
}

export interface ChallengeConfirmationTokenClaims {
  deviceLinkId: string;
  ext: Dict;
  factors: Array<PSD2Factor>;
  strategy: ChallengeStrategy;
}

export interface RdcSessionTokenClaims {
  ext: Dict;
}
