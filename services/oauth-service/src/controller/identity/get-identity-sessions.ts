import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetIdentitySessionsResponse, IdentitySessionItem } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../types";
import { orderBy } from "lodash";
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
      latestAuthentication: session.latestAuthentication.toISOString(),
      levelOfAssurance: session.levelOfAssurance,
      metadata: session.metadata,
      methods: session.methods,
      scopes: session.scopes,
      type: session.type,

      client: {
        id: client.id,
        name: client.name,
        logoUri: client.logoUri,
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
