import { uniqArray } from "@lindorm-io/core";
import { ServerError } from "@lindorm-io/errors";
import { ElevationRequest } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getBrowserSessionCookies } from "../cookies";

export const updateBrowserSessionElevation = async (
  ctx: ServerKoaContext,
  elevationRequest: ElevationRequest,
): Promise<void> => {
  const {
    mongo: { browserSessionRepository },
  } = ctx;

  if (!elevationRequest.browserSessionId) {
    throw new ServerError("Invalid elevation session", {
      debug: { browserSessionId: elevationRequest.browserSessionId },
    });
  }

  const browserSession = await browserSessionRepository.find({
    id: elevationRequest.browserSessionId,
  });

  const cookies = getBrowserSessionCookies(ctx);

  if (!cookies.includes(browserSession.id)) {
    throw new ServerError("Invalid browser session", {
      debug: {
        expect: cookies,
        actual: elevationRequest.browserSessionId,
      },
    });
  }

  if (elevationRequest.identityId !== browserSession.identityId) {
    throw new ServerError("Invalid identity");
  }

  if (
    !elevationRequest.confirmedAuthentication.latestAuthentication ||
    !elevationRequest.confirmedAuthentication.levelOfAssurance ||
    !elevationRequest.confirmedAuthentication.methods
  ) {
    throw new ServerError("Invalid ElevationRequest", {
      debug: { confirmedAuthentication: elevationRequest.confirmedAuthentication },
    });
  }

  browserSession.latestAuthentication =
    elevationRequest.confirmedAuthentication.latestAuthentication;
  browserSession.levelOfAssurance = elevationRequest.confirmedAuthentication.levelOfAssurance;
  browserSession.methods = uniqArray(
    browserSession.methods,
    elevationRequest.confirmedAuthentication.methods,
  );

  await browserSessionRepository.update(browserSession);
};
