import { LevelOfAssurance } from "@lindorm-io/common-types";
import { ms } from "@lindorm-io/readable-time";
import { addMilliseconds, isAfter } from "date-fns";
import { configuration } from "../server/configuration";

interface SessionLike {
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
}

const getHighestPossibleAdjustment = (session: SessionLike): LevelOfAssurance => {
  if (
    isAfter(
      new Date(),
      addMilliseconds(
        session.latestAuthentication,
        ms(configuration.defaults.adjusted_access.loa_1_max),
      ),
    )
  ) {
    return 0;
  }

  if (
    isAfter(
      new Date(),
      addMilliseconds(
        session.latestAuthentication,
        ms(configuration.defaults.adjusted_access.loa_2_max),
      ),
    )
  ) {
    return 1;
  }

  if (
    isAfter(
      new Date(),
      addMilliseconds(
        session.latestAuthentication,
        ms(configuration.defaults.adjusted_access.loa_3_max),
      ),
    )
  ) {
    return 2;
  }

  if (
    isAfter(
      new Date(),
      addMilliseconds(
        session.latestAuthentication,
        ms(configuration.defaults.adjusted_access.loa_4_max),
      ),
    )
  ) {
    return 3;
  }

  return 4;
};

export const getAdjustedAccessLevel = (session: SessionLike): LevelOfAssurance => {
  const highest = getHighestPossibleAdjustment(session);
  return highest >= session.levelOfAssurance ? session.levelOfAssurance : highest;
};
