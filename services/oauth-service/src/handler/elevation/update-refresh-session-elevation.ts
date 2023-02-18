import { ElevationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { uniqArray } from "@lindorm-io/core";

export const updateRefreshSessionElevation = async (
  ctx: ServerKoaContext,
  elevationSession: ElevationSession,
) => {
  const {
    repository: { refreshSessionRepository },
  } = ctx;

  if (!elevationSession.refreshSessionId) {
    throw new ServerError("Invalid elevationSession", {
      debug: { refreshSessionId: elevationSession.refreshSessionId },
    });
  }

  const refreshSession = await refreshSessionRepository.find({
    id: elevationSession.refreshSessionId,
  });

  if (elevationSession.identityId !== refreshSession.identityId) {
    throw new ServerError("Invalid identity");
  }

  if (
    !elevationSession.confirmedAuthentication.latestAuthentication ||
    !elevationSession.confirmedAuthentication.levelOfAssurance ||
    !elevationSession.confirmedAuthentication.methods
  ) {
    throw new ServerError("Invalid elevationSession", {
      debug: { confirmedAuthentication: elevationSession.confirmedAuthentication },
    });
  }

  refreshSession.latestAuthentication =
    elevationSession.confirmedAuthentication.latestAuthentication;
  refreshSession.levelOfAssurance = elevationSession.confirmedAuthentication.levelOfAssurance;
  refreshSession.methods = uniqArray(
    refreshSession.methods,
    elevationSession.confirmedAuthentication.methods,
  );

  await refreshSessionRepository.update(refreshSession);
};
