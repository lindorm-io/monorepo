import { PylonSocketAuth } from "../../../types";

export const markAuthExpiredEmitted = (auth: PylonSocketAuth, now: Date): void => {
  auth.authExpiredEmittedAt = now;
};
