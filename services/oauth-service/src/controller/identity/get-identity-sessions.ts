import Joi from "joi";
import { BrowserSession, RefreshSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetIdentitySessionsResponseBody, IdentitySessionsData, JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { flatten, orderBy } from "lodash";
import { getAdjustedAccessLevel } from "../../util";
import { isAfter } from "date-fns";

interface IdentitySessionsRequestData {
  id: string;
}

export const getIdentitySessionsSchema = Joi.object<IdentitySessionsRequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getIdentitySessionsController: ServerKoaController<
  IdentitySessionsRequestData
> = async (ctx): ControllerResponse<GetIdentitySessionsResponseBody> => {
  const {
    data: { id: identityId },
    repository: { browserSessionRepository, refreshSessionRepository },
  } = ctx;

  const sessions: Array<IdentitySessionsData> = [];

  const now = new Date();

  const browserSessions = await browserSessionRepository.findMany({ identityId });
  const refreshSessions = await refreshSessionRepository.findMany({ identityId });

  const array = flatten<BrowserSession | RefreshSession>([browserSessions, refreshSessions]);

  for (const session of array) {
    if (session.levelOfAssurance === 0) continue;
    if (isAfter(now, session.expires)) continue;

    sessions.push({
      id: session.id,
      adjustedAccessLevel: getAdjustedAccessLevel(session),
      levelOfAssurance: session.levelOfAssurance,
    });
  }

  return { body: { sessions: orderBy(sessions, ["levelOfAssurance"], ["asc"]) } };
};
