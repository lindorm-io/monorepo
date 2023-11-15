import { TransformMode } from "@lindorm-io/case";
import { createURL } from "@lindorm-io/url";
import { ElevationSession } from "../../entity";

export const createElevationRejectedUri = (elevationSession: ElevationSession): string =>
  createURL(elevationSession.redirectUri!, {
    query: {
      error: "request_rejected",
      errorDescription: "elevation_rejected",
      state: elevationSession.state,
    },
    queryCaseTransform: TransformMode.SNAKE,
  }).toString();
