import { VerifiedAuthenticationConfirmationToken } from "../common";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { getAdjustedAccessLevel } from "./get-adjusted-access-level";

interface ISession {
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
}

export const calculateUpdatedLoa = (
  session: ISession,
  token: VerifiedAuthenticationConfirmationToken,
): LevelOfAssurance => {
  const {
    claims: { maximumLoa },
    levelOfAssurance,
  } = token;

  if (levelOfAssurance >= session.levelOfAssurance) {
    return levelOfAssurance as LevelOfAssurance;
  }

  const adjustedAccessLevel = getAdjustedAccessLevel(session);
  const calculated = (adjustedAccessLevel + levelOfAssurance) as LevelOfAssurance;

  return (calculated >= maximumLoa ? maximumLoa : calculated) as LevelOfAssurance;
};
