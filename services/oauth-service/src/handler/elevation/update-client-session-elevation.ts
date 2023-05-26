import { uniqArray } from "@lindorm-io/core";
import { ServerError } from "@lindorm-io/errors";
import { ElevationSession } from "../../entity";
import { ServerKoaContext } from "../../types";

export const updateClientSessionElevation = async (
  ctx: ServerKoaContext,
  elevationSession: ElevationSession,
) => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (!elevationSession.clientSessionId) {
    throw new ServerError("Invalid ElevationSession", {
      debug: { clientSessionId: elevationSession.clientSessionId },
    });
  }

  const clientSession = await clientSessionRepository.find({
    id: elevationSession.clientSessionId,
  });

  if (elevationSession.identityId !== clientSession.identityId) {
    throw new ServerError("Invalid identity");
  }

  if (
    !elevationSession.confirmedAuthentication.latestAuthentication ||
    !elevationSession.confirmedAuthentication.levelOfAssurance ||
    !elevationSession.confirmedAuthentication.methods
  ) {
    throw new ServerError("Invalid ElevationSession", {
      debug: { confirmedAuthentication: elevationSession.confirmedAuthentication },
    });
  }

  clientSession.latestAuthentication =
    elevationSession.confirmedAuthentication.latestAuthentication;
  clientSession.levelOfAssurance = elevationSession.confirmedAuthentication.levelOfAssurance;
  clientSession.methods = uniqArray(
    clientSession.methods,
    elevationSession.confirmedAuthentication.methods,
  );

  await clientSessionRepository.update(clientSession);
};
