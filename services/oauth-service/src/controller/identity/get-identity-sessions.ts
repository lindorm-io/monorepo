import Joi from "joi";
import { AccessSession, RefreshSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { flatten, orderBy } from "lodash";
import { getAdjustedAccessLevel } from "../../util";
import { isAfter } from "date-fns";
import { GetIdentitySessionsResponse, IdentitySessionItem } from "@lindorm-io/common-types";
import { SessionHint } from "../../enum";

type RequestData = {
  id: string;
};

type ResponseBody = GetIdentitySessionsResponse;

export const getIdentitySessionsSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getIdentitySessionsController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id: identityId },
    repository: { accessSessionRepository, refreshSessionRepository },
  } = ctx;

  const sessions: Array<IdentitySessionItem> = [];

  const now = new Date();

  const accessSessions = await accessSessionRepository.findMany({ identityId });
  const refreshSessions = await refreshSessionRepository.findMany({ identityId });

  const array = flatten<AccessSession | RefreshSession>([accessSessions, refreshSessions]);

  for (const session of array) {
    if (session.levelOfAssurance === 0) continue;
    if (session instanceof RefreshSession && isAfter(now, session.expires)) continue;

    sessions.push({
      id: session.id,
      adjustedAccessLevel: getAdjustedAccessLevel(session),
      latestAuthentication: session.latestAuthentication,
      levelOfAssurance: session.levelOfAssurance,
      methods: session.methods,
      scopes: session.scopes,
      type: session instanceof AccessSession ? SessionHint.ACCESS : SessionHint.REFRESH,
    });
  }

  return {
    body: {
      sessions: orderBy(sessions, ["levelOfAssurance"], ["asc"]),
    },
  };
};
