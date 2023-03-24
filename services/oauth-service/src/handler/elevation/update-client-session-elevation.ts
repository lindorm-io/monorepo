import { ElevationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { uniqArray } from "@lindorm-io/core";

export const updateClientSessionElevation = async (
  ctx: ServerKoaContext,
  elevationSession: ElevationSession,
) => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (!elevationSession.clientSessionId) {
    throw new ServerError("Invalid elevationSession", {
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
    throw new ServerError("Invalid elevationSession", {
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
