import { ClientError } from "@lindorm/errors";
import { CorsOptions } from "../../../types";
import { matchOrigin } from "./match-origin";

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
