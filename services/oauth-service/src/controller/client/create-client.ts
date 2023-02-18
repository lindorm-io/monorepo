import Joi from "joi";
import { Client } from "../../entity";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { argon } from "../../instance";
import { configuration } from "../../server/configuration";
import { randomString } from "@lindorm-io/random";
import {
  LevelOfAssurance,
  OauthClientTypes,
  OauthDisplayModes,
  OauthResponseModes,
} from "@lindorm-io/common-types";

type RequestData = {
  description: string;
  host: string;
  name: string;
  postLogoutUris: Array<string>;
  redirectUris: Array<string>;
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
    postLogoutUris: Joi.array().items(Joi.string().uri()).required(),
    redirectUris: Joi.array().items(Joi.string().uri()).required(),
    tenantId: Joi.string().guid().required(),
  })
  .required();

export const createClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { clientCache },
    data: { description, host, name, postLogoutUris, redirectUris },
    entity: { tenant },
    repository: { clientRepository },
  } = ctx;

  const secret = randomString(128);

  const client = await clientRepository.create(
    new Client({
      defaults: {
        audiences: [],
        displayMode: OauthDisplayModes.PAGE,
        levelOfAssurance: configuration.defaults.clients.level_of_assurance as LevelOfAssurance,
        responseMode: OauthResponseModes.QUERY,
      },

      active: configuration.defaults.clients.active_state,
      description,
      host,
      name,
      postLogoutUris,
      redirectUris,
      secret: await argon.encrypt(secret),
      tenantId: tenant.id,
      type: OauthClientTypes.PUBLIC,
    }),
  );

  await clientCache.create(client);

  return {
    body: { id: client.id, secret },
    status: HttpStatus.Success.CREATED,
  };
};
