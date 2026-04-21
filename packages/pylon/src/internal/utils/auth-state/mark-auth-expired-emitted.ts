import type { PylonSocketAuth } from "../../../types/index.js";

export const markAuthExpiredEmitted = (auth: PylonSocketAuth, now: Date): void => {
  auth.authExpiredEmittedAt = now;
};
