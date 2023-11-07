import { AuthenticationLevel, LevelOfAssurance } from "@lindorm-io/common-types";

export const getAuthenticationLevelFromLevelOfAssurance = (
  loa: LevelOfAssurance,
): AuthenticationLevel => {
  if (loa === 4) return AuthenticationLevel.LOA_4;
  if (loa === 3) return AuthenticationLevel.LOA_3;
  if (loa === 2) return AuthenticationLevel.LOA_2;
  if (loa === 1) return AuthenticationLevel.LOA_1;

  return AuthenticationLevel.LOA_0;
};
