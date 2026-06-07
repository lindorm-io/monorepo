import { ClientError } from "@lindorm/errors";
import type { CorsOptions } from "../../../types/index.js";
import { matchOrigin } from "./match-origin.js";

export const assertAllowedOrigin = (
  origin: string | undefined,
  allowOrigins: CorsOptions["allowOrigins"],
): void => {
  if (!origin) {
    throw new ClientError("Origin header is missing", {
      status: ClientError.Status.Forbidden,
      code: "origin_missing",
      type: "urn:lindorm:pylon:error:origin_missing",
    });
  }

  if (!matchOrigin(origin, allowOrigins)) {
    throw new ClientError("Request origin is not allowed", {
      status: ClientError.Status.Forbidden,
      code: "origin_not_allowed",
      type: "urn:lindorm:pylon:error:origin_not_allowed",
      data: { origin },
      debug: { allowOrigins },
    });
  }
};
