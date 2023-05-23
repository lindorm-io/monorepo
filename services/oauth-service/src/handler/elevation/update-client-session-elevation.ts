import { uniqArray } from "@lindorm-io/core";
import { ServerError } from "@lindorm-io/errors";
import { ElevationRequest } from "../../entity";
import { ServerKoaContext } from "../../types";

export const updateClientSessionElevation = async (
  ctx: ServerKoaContext,
  elevationRequest: ElevationRequest,
) => {
  const {
    mongo: { clientSessionRepository },
  } = ctx;

  if (!elevationRequest.clientSessionId) {
    throw new ServerError("Invalid ElevationRequest", {
      debug: { clientSessionId: elevationRequest.clientSessionId },
    });
  }

  const clientSession = await clientSessionRepository.find({
    id: elevationRequest.clientSessionId,
  });

  if (elevationRequest.identityId !== clientSession.identityId) {
    throw new ServerError("Invalid identity");
  }

  if (
    !elevationRequest.confirmedAuthentication.latestAuthentication ||
    !elevationRequest.confirmedAuthentication.levelOfAssurance ||
    !elevationRequest.confirmedAuthentication.methods
  ) {
    throw new ServerError("Invalid ElevationRequest", {
      debug: { confirmedAuthentication: elevationRequest.confirmedAuthentication },
    });
  }

  clientSession.latestAuthentication =
    elevationRequest.confirmedAuthentication.latestAuthentication;
  clientSession.levelOfAssurance = elevationRequest.confirmedAuthentication.levelOfAssurance;
  clientSession.methods = uniqArray(
    clientSession.methods,
    elevationRequest.confirmedAuthentication.methods,
  );

  await clientSessionRepository.update(clientSession);
};
