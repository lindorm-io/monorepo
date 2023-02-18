import { ElevationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { uniqArray } from "@lindorm-io/core";

export const updateAccessSessionElevation = async (
  ctx: ServerKoaContext,
  elevationSession: ElevationSession,
): Promise<void> => {
  const {
    repository: { accessSessionRepository },
  } = ctx;

  if (!elevationSession.accessSessionId) {
    throw new ServerError("Invalid elevation session", {
      debug: { accessSessionId: elevationSession.accessSessionId },
    });
  }

  const accessSession = await accessSessionRepository.find({
    id: elevationSession.accessSessionId,
  });

  if (elevationSession.identityId !== accessSession.identityId) {
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

  accessSession.latestAuthentication =
    elevationSession.confirmedAuthentication.latestAuthentication;
  accessSession.levelOfAssurance = elevationSession.confirmedAuthentication.levelOfAssurance;
  accessSession.methods = uniqArray(
    accessSession.methods,
    elevationSession.confirmedAuthentication.methods,
  );

  await accessSessionRepository.update(accessSession);
};
