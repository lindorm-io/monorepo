import Joi from "joi";
import { BrowserSession, RefreshSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { flatten, orderBy } from "lodash";
import { getAdjustedAccessLevel } from "../../util";
import { isAfter } from "date-fns";
import { IdentitySessionItem, GetIdentitySessionsResponse } from "@lindorm-io/common-types";

type RequestData = {
  id: string;
};

export const getIdentitySessionsSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getIdentitySessionsController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<GetIdentitySessionsResponse> => {
  const {
    data: { id: identityId },
    repository: { browserSessionRepository, refreshSessionRepository },
  } = ctx;

  const sessions: Array<IdentitySessionItem> = [];

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
