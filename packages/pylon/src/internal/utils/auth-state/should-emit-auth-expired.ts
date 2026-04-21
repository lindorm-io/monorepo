import type { PylonSocketAuth } from "../../../types/index.js";

export const shouldEmitAuthExpired = (
  auth: Pick<PylonSocketAuth, "authExpiredEmittedAt">,
  _now: Date,
): boolean => auth.authExpiredEmittedAt === null;
