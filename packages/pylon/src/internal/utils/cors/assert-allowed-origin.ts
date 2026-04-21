import { ClientError } from "@lindorm/errors";
import type { CorsOptions } from "../../../types/index.js";
import { matchOrigin } from "./match-origin.js";

export const assertAllowedOrigin = (
  origin: string | undefined,
  allowOrigins: CorsOptions["allowOrigins"],
): void => {
  if (!origin) {
    throw new ClientError("Missing Origin header", {
      status: ClientError.Status.Forbidden,
      code: "origin_missing",
    });
  }

  if (!matchOrigin(origin, allowOrigins)) {
    throw new ClientError("Origin not allowed", {
      status: ClientError.Status.Forbidden,
      code: "origin_not_allowed",
      debug: { origin },
    });
  }
};
