import { LevelOfAssurance } from "@lindorm-io/common-types";
import { VerifiedAuthenticationConfirmationToken } from "../common";
import { calculateUpdatedLoa } from "./calculate-updated-loa";
import { flatten, uniq } from "lodash";
import { fromUnixTime } from "date-fns";

interface SessionLike {
  acrValues: Array<string>;
  amrValues: Array<string>;
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
}

export const updateSessionWithAuthToken = <Session extends SessionLike>(
  session: Session,
  token: VerifiedAuthenticationConfirmationToken,
): Session => {
  const { authMethodsReference, authTime } = token;
  const levelOfAssurance = calculateUpdatedLoa(session, token);

  session.acrValues = [`loa_${levelOfAssurance}`];
  session.amrValues = uniq(flatten([session.amrValues, authMethodsReference])).sort();
  session.latestAuthentication = fromUnixTime(authTime);
  session.levelOfAssurance = levelOfAssurance;

  return session;
};
