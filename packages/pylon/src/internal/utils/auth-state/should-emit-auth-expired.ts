import { PylonSocketAuth } from "../../../types";

export const shouldEmitAuthExpired = (
  auth: Pick<PylonSocketAuth, "authExpiredEmittedAt">,
  _now: Date,
): boolean => auth.authExpiredEmittedAt === null;
