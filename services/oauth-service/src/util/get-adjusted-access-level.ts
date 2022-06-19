import { LevelOfAssurance } from "../common";
import { addDays, addMinutes, isAfter } from "date-fns";
import { configuration } from "../server/configuration";

interface ISession {
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
}

const getHighestPossibleAdjustment = (session: ISession): LevelOfAssurance => {
  if (
    isAfter(
      new Date(),
      addDays(session.latestAuthentication, configuration.defaults.sessions.loa_1_max_days),
    )
  ) {
    return 0;
  }

  if (
    isAfter(
      new Date(),
      addDays(session.latestAuthentication, configuration.defaults.sessions.loa_2_max_days),
    )
  ) {
    return 1;
  }

  if (
    isAfter(
      new Date(),
      addDays(session.latestAuthentication, configuration.defaults.sessions.loa_3_max_days),
    )
  ) {
    return 2;
  }

  if (
    isAfter(
      new Date(),
      addMinutes(session.latestAuthentication, configuration.defaults.sessions.loa_4_max_minutes),
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
