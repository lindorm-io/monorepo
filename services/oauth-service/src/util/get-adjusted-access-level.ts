import { BrowserSession, RefreshSession } from "../entity";
import { addDays, isAfter } from "date-fns";
import { configuration } from "../server/configuration";
import { LevelOfAssurance } from "../common";

const getHighestPossibleAdjustment = (
  session: BrowserSession | RefreshSession,
): LevelOfAssurance => {
  if (
    isAfter(
      new Date(),
      addDays(session.latestAuthentication, configuration.defaults.sessions.maximum_days_loa_1),
    )
  ) {
    return 0;
  }

  if (
    isAfter(
      new Date(),
      addDays(session.latestAuthentication, configuration.defaults.sessions.maximum_days_loa_2),
    )
  ) {
    return 1;
  }

  if (
    isAfter(
      new Date(),
      addDays(session.latestAuthentication, configuration.defaults.sessions.maximum_days_loa_3),
    )
  ) {
    return 2;
  }

  if (
    isAfter(
      new Date(),
      addDays(session.latestAuthentication, configuration.defaults.sessions.maximum_days_loa_4),
    )
  ) {
    return 3;
  }

  return 4;
};

export const getAdjustedAccessLevel = (
  session: BrowserSession | RefreshSession,
): LevelOfAssurance => {
  const highest = getHighestPossibleAdjustment(session);

  return highest >= session.levelOfAssurance ? session.levelOfAssurance : highest;
};
