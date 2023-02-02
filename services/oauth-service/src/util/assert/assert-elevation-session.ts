import { ElevationSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";

export const assertElevationSession = (elevationSession: ElevationSession): void => {
  if (
    elevationSession.confirmedAuthentication.acrValues &&
    elevationSession.confirmedAuthentication.amrValues &&
    elevationSession.confirmedAuthentication.latestAuthentication &&
    elevationSession.confirmedAuthentication.levelOfAssurance
  ) {
    return;
  }

  throw new ServerError("Unexpected session data", {
    description: "Elevation session has invalid authentication data",
    debug: {
      confirmedAuthentication: elevationSession.confirmedAuthentication,
    },
  });
};
