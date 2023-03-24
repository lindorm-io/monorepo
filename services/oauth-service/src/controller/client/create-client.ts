import Joi from "joi";
import { Client } from "../../entity";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { argon } from "../../instance";
import { configuration } from "../../server/configuration";
import { randomUnreserved } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import {
  LevelOfAssurance,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdResponseMode,
  OpenIdResponseType,
  OpenIdScope,
} from "@lindorm-io/common-types";

type RequestData = {
  description: string;
  host: string;
  name: string;
  tenantId: string;
};

type ResponseBody = {
  id: string;
  secret: string;
};

export const createClientSchema = Joi.object<RequestData>()
  .keys({
    description: Joi.string().required(),
    host: Joi.string().uri().required(),
    name: Joi.string().required(),
    tenantId: Joi.string().guid().required(),
  })
  .required();

export const createClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { description, host, name },
    entity: { tenant },
    mongo: { clientRepository },
  } = ctx;

  const id = randomUUID();
  const secret = randomUnreserved(128);

  await clientRepository.create(
    new Client({
      id,
      allowed: {
        grantTypes: [
          OpenIdGrantType.AUTHORIZATION_CODE,
          OpenIdGrantType.CLIENT_CREDENTIALS,
          OpenIdGrantType.REFRESH_TOKEN,
        ],
        responseTypes: [
          OpenIdResponseType.CODE,
          OpenIdResponseType.ID_TOKEN,
          OpenIdResponseType.TOKEN,
        ],
        scopes: [OpenIdScope.OPENID, OpenIdScope.PROFILE, OpenIdScope.OFFLINE_ACCESS],
      },

      defaults: {
        audiences: [id],
        displayMode: OpenIdDisplayMode.PAGE,
        levelOfAssurance: configuration.defaults.clients.level_of_assurance as LevelOfAssurance,
        responseMode: OpenIdResponseMode.QUERY,
      },

      active: configuration.defaults.clients.active_state,
      description,
      host,
      name,
      opaque: false,
      secret: await argon.encrypt(secret),
      tenantId: tenant.id,
      type: OpenIdClientType.PUBLIC,
    }),
  );

  return {
    body: { id, secret },
    status: HttpStatus.Success.CREATED,
  };
};
