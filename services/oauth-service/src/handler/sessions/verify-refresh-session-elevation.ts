import { ElevationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { ServerError } from "@lindorm-io/errors";
import { assertElevationSession } from "../../util";

export const verifyRefreshSessionElevation = async (
  ctx: ServerKoaContext,
  elevationSession: ElevationSession,
) => {
  const {
    repository: { refreshSessionRepository },
  } = ctx;

  assertElevationSession(elevationSession);

  const refreshSession = await refreshSessionRepository.find({
    id: elevationSession.identifiers.refreshSessionId,
  });

  if (elevationSession.identityId !== refreshSession.identityId) {
    throw new ServerError("Invalid identity");
  }

  const { acrValues, amrValues, latestAuthentication, levelOfAssurance } =
    elevationSession.confirmedAuthentication;

  refreshSession.acrValues = acrValues;
  refreshSession.amrValues = amrValues;
  refreshSession.latestAuthentication = latestAuthentication;
  refreshSession.levelOfAssurance = levelOfAssurance;

  await refreshSessionRepository.update(refreshSession);
};
