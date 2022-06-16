import { LevelOfAssurance } from "../common";
import { addDays, isAfter } from "date-fns";
import { configuration } from "../server/configuration";

interface ISession {
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
}

const getHighestPossibleAdjustment = (session: ISession): LevelOfAssurance => {
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

export const getAdjustedAccessLevel = (session: ISession): LevelOfAssurance => {
  const highest = getHighestPossibleAdjustment(session);
  return highest >= session.levelOfAssurance ? session.levelOfAssurance : highest;
};
