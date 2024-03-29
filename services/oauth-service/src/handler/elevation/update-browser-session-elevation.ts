import { uniqArray } from "@lindorm-io/core";
import { ServerError } from "@lindorm-io/errors";
import { ElevationSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getBrowserSessionCookies } from "../cookies";

export const updateBrowserSessionElevation = async (
  ctx: ServerKoaContext,
  elevationSession: ElevationSession,
): Promise<void> => {
  const {
    mongo: { browserSessionRepository },
  } = ctx;

  if (!elevationSession.browserSessionId) {
    throw new ServerError("Invalid elevation session", {
      debug: { browserSessionId: elevationSession.browserSessionId },
    });
  }

  const browserSession = await browserSessionRepository.find({
    id: elevationSession.browserSessionId,
  });

  const cookies = getBrowserSessionCookies(ctx);

  if (!cookies.includes(browserSession.id)) {
    throw new ServerError("Invalid browser session", {
      debug: {
        expect: cookies,
        actual: elevationSession.browserSessionId,
      },
    });
  }

  if (elevationSession.identityId !== browserSession.identityId) {
    throw new ServerError("Invalid identity");
  }

  if (
    !elevationSession.confirmedAuthentication.latestAuthentication ||
    !elevationSession.confirmedAuthentication.levelOfAssurance ||
    !elevationSession.confirmedAuthentication.methods
  ) {
    throw new ServerError("Invalid ElevationSession", {
      debug: { confirmedAuthentication: elevationSession.confirmedAuthentication },
    });
  }

  browserSession.factors = uniqArray(
    browserSession.factors,
    elevationSession.confirmedAuthentication.factors,
  );

  browserSession.latestAuthentication =
    elevationSession.confirmedAuthentication.latestAuthentication;

  browserSession.levelOfAssurance = elevationSession.confirmedAuthentication.levelOfAssurance;

  browserSession.methods = uniqArray(
    browserSession.methods,
    elevationSession.confirmedAuthentication.methods,
  );

  browserSession.strategies = uniqArray(
    browserSession.strategies,
    elevationSession.confirmedAuthentication.strategies,
  );

  await browserSessionRepository.update(browserSession);
};
