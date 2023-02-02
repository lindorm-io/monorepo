import Joi from "joi";
import { Client } from "../../entity";
import { ClientType, DisplayMode, JOI_GUID, ResponseMode } from "../../common";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { argon } from "../../instance";
import { configuration } from "../../server/configuration";
import { randomString } from "@lindorm-io/random";

interface RequestData {
  description: string;
  host: string;
  logoutUri: string;
  name: string;
  redirectUris: Array<string>;
  tenantId: string;
}

interface ResponseBody {
  id: string;
  secret: string;
}

export const createClientSchema = Joi.object<RequestData>()
  .keys({
    description: Joi.string().required(),
    host: Joi.string().uri().required(),
    logoutUri: Joi.string().uri().required(),
    name: Joi.string().required(),
    redirectUris: Joi.array().items(Joi.string().uri()).required(),
    tenantId: JOI_GUID.required(),
  })
  .required();

export const createClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { clientCache },
    data: { description, host, logoutUri, name, redirectUris },
    entity: { tenant },
    repository: { clientRepository },
  } = ctx;

  const secret = randomString(128);

  const client = await clientRepository.create(
    new Client({
      active: configuration.defaults.clients.active_state,
      defaults: {
        audiences: [],
        displayMode: DisplayMode.PAGE,
        levelOfAssurance: configuration.defaults.clients.level_of_assurance as LevelOfAssurance,
        responseMode: ResponseMode.QUERY,
      },
      description,
      host,
      logoutUri,
      name,
      tenant: tenant.id,
      redirectUris,
      secret: await argon.encrypt(secret),
      type: ClientType.PUBLIC,
    }),
  );

  await clientCache.create(client);

  return {
    body: { id: client.id, secret },
    status: HttpStatus.Success.CREATED,
  };
};
