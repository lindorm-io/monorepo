import Joi from "joi";
import { AccessSession, RefreshSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetIdentitySessionsResponse, IdentitySessionItem } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../types";
import { SessionHint } from "../../enum";
import { flatten, orderBy } from "lodash";
import { getAdjustedAccessLevel } from "../../util";
import { isAfter } from "date-fns";

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
    repository: {
      accessSessionRepository,
      clientRepository,
      refreshSessionRepository,
      tenantRepository,
    },
  } = ctx;

  const sessions: Array<IdentitySessionItem> = [];

  const accessSessions = await accessSessionRepository.findMany({ identityId });
  const refreshSessions = await refreshSessionRepository.findMany({ identityId });

  const array = flatten<AccessSession | RefreshSession>([accessSessions, refreshSessions]);

  for (const session of array) {
    if (session.levelOfAssurance === 0) continue;
    if (session instanceof RefreshSession && isAfter(new Date(), session.expires)) continue;

    const client = await clientRepository.find({ id: session.clientId });
    const tenant = await tenantRepository.find({ id: client.tenantId });

    sessions.push({
      id: session.id,
      client: {
        name: client.name,
        logoUri: client.logoUri,
        tenant: tenant.name,
        type: client.type,
      },
      adjustedAccessLevel: getAdjustedAccessLevel(session),
      latestAuthentication: session.latestAuthentication.toISOString(),
      levelOfAssurance: session.levelOfAssurance,
      metadata: session.metadata,
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
