import { AuthenticationLevel } from "@lindorm-io/common-enums";
import { LevelOfAssurance } from "@lindorm-io/common-types";
import { URN } from "../types";

export const getLevelOfAssuranceFromAuthenticationLevel = (urn: Array<URN>): LevelOfAssurance => {
  if (urn.includes(AuthenticationLevel.LOA_4)) return 4;
  if (urn.includes(AuthenticationLevel.LOA_3)) return 3;
  if (urn.includes(AuthenticationLevel.LOA_2)) return 2;
  if (urn.includes(AuthenticationLevel.LOA_1)) return 1;
  return 0;
};
