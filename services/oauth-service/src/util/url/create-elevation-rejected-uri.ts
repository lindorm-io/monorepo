import { createURL } from "@lindorm-io/url";
import { ElevationRequest } from "../../entity";

export const createElevationRejectedUri = (elevationRequest: ElevationRequest): string =>
  createURL(elevationRequest.redirectUri!, {
    query: {
      error: "request_rejected",
      error_description: "elevation_rejected",
      state: elevationRequest.state,
    },
  }).toString();
