import { GetIdentitySessionsResponse, IdentitySessionItem } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { orderBy } from "lodash";
import { ServerKoaController } from "../../types";
import { getAdjustedAccessLevel } from "../../util";

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
    mongo: { clientRepository, clientSessionRepository, tenantRepository },
  } = ctx;

  const sessions: Array<IdentitySessionItem> = [];

  const clientSessions = await clientSessionRepository.findMany({ identityId });

  for (const session of clientSessions) {
    if (session.levelOfAssurance === 0) continue;

    const client = await clientRepository.find({ id: session.clientId });
    const tenant = await tenantRepository.find({ id: client.tenantId });

    sessions.push({
      id: session.id,
      adjustedAccessLevel: getAdjustedAccessLevel(session),
      factors: session.factors,
      latestAuthentication: session.latestAuthentication.toISOString(),
      levelOfAssurance: session.levelOfAssurance,
      metadata: session.metadata,
      methods: session.methods,
      scopes: session.scopes,
      strategies: session.strategies,
      type: session.type,

      client: {
        id: client.id,
        name: client.name,
        logoUri: client.logoUri,
        singleSignOn: client.singleSignOn,
        type: client.type,
      },

      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    });
  }

  return {
    body: {
      sessions: orderBy(sessions, ["levelOfAssurance"], ["asc"]),
    },
  };
};
