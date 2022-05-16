import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { isAfter } from "date-fns";
import { orderBy } from "lodash";
import { GetIdentitySessionsResponseBody, IdentitySessionsData, JOI_GUID } from "../../common";

interface IdentitySessionsRequestData {
  id: string;
}

export const getIdentitySessionsSchema = Joi.object<IdentitySessionsRequestData>({
  id: JOI_GUID.required(),
});

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

  for (const session of browserSessions) {
    if (session.levelOfAssurance === 0) continue;
    if (isAfter(now, session.expires)) continue;

    sessions.push({ id: session.id, levelOfAssurance: session.levelOfAssurance });
  }

  const refreshSessions = await refreshSessionRepository.findMany({ identityId });

  for (const session of refreshSessions) {
    if (session.levelOfAssurance === 0) continue;
    if (isAfter(now, session.expires)) continue;

    sessions.push({ id: session.id, levelOfAssurance: session.levelOfAssurance });
  }

  return {
    body: {
      sessions: orderBy(sessions, ["levelOfAssurance"], ["asc"]),
    },
  };
};
