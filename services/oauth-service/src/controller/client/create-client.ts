import {
  OpenIdClientProfile,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdResponseMode,
  OpenIdResponseType,
  OpenIdScope,
} from "@lindorm-io/common-types";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { randomUnreserved } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import Joi from "joi";
import { Client } from "../../entity";
import { argon } from "../../instance";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

type RequestData = {
  description: string;
  host: string;
  name: string;
  profile: OpenIdClientProfile;
  tenantId: string;
  type: OpenIdClientType;
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
    profile: Joi.string()
      .valid(...Object.values(OpenIdClientProfile))
      .required(),
    tenantId: Joi.string().guid().required(),
    type: Joi.string()
      .valid(...Object.values(OpenIdClientType))
      .required(),
  })
  .required();

export const createClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { description, host, name, profile, type },
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
        methods: [],
        responseTypes: [
          OpenIdResponseType.CODE,
          OpenIdResponseType.ID_TOKEN,
          OpenIdResponseType.TOKEN,
        ],
        scopes: [OpenIdScope.OPENID, OpenIdScope.PROFILE, OpenIdScope.OFFLINE_ACCESS],
        strategies: [],
      },

      audiences: {
        credentials: [],
        identity: [],
      },

      authenticationAssertion: {
        algorithm: null,
        issuer: null,
        secret: null,
      },

      authorizationAssertion: {
        algorithm: null,
        issuer: null,
        secret: null,
      },

      defaults: {
        displayMode: OpenIdDisplayMode.PAGE,
        levelOfAssurance: 1,
        responseMode: OpenIdResponseMode.QUERY,
      },

      expiry: {
        accessToken: configuration.defaults.expiry.access_token,
        idToken: configuration.defaults.expiry.id_token,
        refreshToken: configuration.defaults.expiry.refresh_token,
      },

      active: true,
      description,
      host,
      name,
      opaqueAccessToken: true,
      profile,
      secret: await argon.encrypt(secret),
      singleSignOn: true,
      tenantId: tenant.id,
      trusted: tenant.trusted,
      type,
    }),
  );

  return {
    body: { id, secret },
    status: HttpStatus.Success.CREATED,
  };
};
