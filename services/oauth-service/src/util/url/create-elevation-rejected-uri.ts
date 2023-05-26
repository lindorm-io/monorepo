import { createURL } from "@lindorm-io/url";
import { ElevationSession } from "../../entity";

export const createElevationRejectedUri = (elevationSession: ElevationSession): string =>
  createURL(elevationSession.redirectUri!, {
    query: {
      error: "request_rejected",
      error_description: "elevation_rejected",
      state: elevationSession.state,
    },
  }).toString();
