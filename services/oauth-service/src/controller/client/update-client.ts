import { AesEncryption, AesEncryptionKeyAlgorithm } from "@lindorm-io/aes";
import {
  OpenIdBackchannelAuthMode,
  OpenIdClientProfile,
  OpenIdClientType,
  Scope,
} from "@lindorm-io/common-enums";
import { ScopeDescription } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE, JOI_SCOPE_DESCRIPTION } from "../../common";
import {
  JOI_DISPLAY_MODE,
  JOI_EXPIRY_REGEX,
  JOI_GRANT_TYPE,
  JOI_RESPONSE_MODE,
  JOI_RESPONSE_TYPE,
} from "../../constant";
import {
  ClientAllowed,
  ClientAudiences,
  ClientBackchannelAuth,
  ClientCustomClaims,
  ClientDefaults,
  ClientExpiry,
  ClientIdTokenEncryption,
} from "../../entity";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
  active?: boolean;
  allowed?: ClientAllowed;
  audiences?: ClientAudiences;
  backchannelAuth?: ClientBackchannelAuth;
  backchannelLogoutUri?: string;
  customClaims?: ClientCustomClaims;
  defaults?: ClientDefaults;
  description?: string;
  domain?: string;
  expiry?: ClientExpiry;
  frontChannelLogoutUri?: string;
  idTokenEncryption?: ClientIdTokenEncryption;
  jwks: Array<string>;
  jwksUri: string | null;
  logoUri?: string;
  name?: string;
  postLogoutUris?: Array<string>;
  profile?: OpenIdClientProfile;
  redirectUris?: Array<string>;
  requiredScopes?: Array<Scope | string>;
  rtbfUri?: string;
  scopeDescriptions?: Array<ScopeDescription>;
  trusted?: boolean;
  type?: OpenIdClientType;
};

export const updateClientSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid(),

    allowed: Joi.object().keys({
      grantTypes: Joi.array().items(JOI_GRANT_TYPE),
      responseTypes: Joi.array().items(JOI_RESPONSE_TYPE),
      scopes: Joi.array().items(Joi.string()),
    }),
    audiences: Joi.object().keys({
      client: Joi.array().items(Joi.string().guid()),
      identity: Joi.array().items(Joi.string().guid()),
    }),
    backchannelAuth: Joi.object().keys({
      mode: Joi.string().valid(...Object.values(OpenIdBackchannelAuthMode)),
      uri: Joi.string().uri().allow(null),
      username: Joi.string().allow(null),
      password: Joi.string().allow(null),
    }),
    customClaims: Joi.object().keys({
      uri: Joi.string().uri().allow(null),
      username: Joi.string().allow(null),
      password: Joi.string().allow(null),
    }),
    defaults: Joi.object().keys({
      displayMode: JOI_DISPLAY_MODE,
      levelOfAssurance: JOI_LEVEL_OF_ASSURANCE,
      responseMode: JOI_RESPONSE_MODE,
    }),
    expiry: Joi.object().keys({
      accessToken: JOI_EXPIRY_REGEX,
      idToken: JOI_EXPIRY_REGEX,
      refreshToken: JOI_EXPIRY_REGEX,
    }),
    idTokenEncryption: Joi.object<ClientIdTokenEncryption>().keys({
      algorithm: Joi.string()
        .valid(...Object.values(AesEncryption))
        .allow(null),
      encryptionKeyAlgorithm: Joi.string()
        .valid(...Object.values(AesEncryptionKeyAlgorithm))
        .allow(null),
    }),

    active: Joi.boolean(),
    backchannelLogoutUri: Joi.string().uri(),
    description: Joi.string().allow(null),
    domain: Joi.string().uri(),
    frontChannelLogoutUri: Joi.string().uri().allow(null),
    jwks: Joi.array().items(Joi.string()).required(),
    jwksUri: Joi.string().uri().allow(null).required(),
    logoUri: Joi.string().uri().allow(null),
    name: Joi.string(),
    postLogoutUris: Joi.array().items(Joi.string().uri()),
    profile: Joi.string().valid(...Object.values(OpenIdClientProfile)),
    redirectUris: Joi.array().items(Joi.string().uri()),
    requiredScopes: Joi.array().items(Joi.string()),
    rtbfUri: Joi.string().uri().allow(null),
    scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION),
    trusted: Joi.boolean(),
    type: Joi.string().valid(...Object.values(OpenIdClientType)),
  })
  .required();

export const updateClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: {
      active,
      allowed,
      audiences,
      backchannelAuth,
      backchannelLogoutUri,
      customClaims,
      defaults,
      description,
      domain,
      expiry,
      frontChannelLogoutUri,
      idTokenEncryption,
      jwks,
      jwksUri,
      logoUri,
      name,
      postLogoutUris,
      profile,
      redirectUris,
      requiredScopes,
      rtbfUri,
      scopeDescriptions,
      trusted,
      type,
    },
    entity: { client },
    mongo: { clientRepository },
  } = ctx;

  if (allowed?.codeChallengeMethods !== undefined) {
    client.allowed.codeChallengeMethods = allowed.codeChallengeMethods;
  }
  if (allowed?.grantTypes !== undefined) {
    client.allowed.grantTypes = allowed.grantTypes;
  }
  if (allowed?.methods !== undefined) {
    client.allowed.methods = allowed.methods;
  }
  if (allowed?.responseTypes !== undefined) {
    client.allowed.responseTypes = allowed.responseTypes;
  }
  if (allowed?.scopes !== undefined) {
    client.allowed.scopes = allowed.scopes;
  }
  if (allowed?.strategies !== undefined) {
    client.allowed.strategies = allowed.strategies;
  }

  if (audiences?.credentials !== undefined) {
    client.audiences.credentials = audiences.credentials;
  }
  if (audiences?.identity !== undefined) {
    client.audiences.identity = audiences.identity;
  }

  if (backchannelAuth?.mode !== undefined) {
    client.backchannelAuth.mode = backchannelAuth.mode;
  }
  if (backchannelAuth?.uri !== undefined) {
    client.backchannelAuth.uri = backchannelAuth.uri;
  }
  if (backchannelAuth?.username !== undefined) {
    client.backchannelAuth.username = backchannelAuth.username;
  }
  if (backchannelAuth?.password !== undefined) {
    client.backchannelAuth.password = backchannelAuth.password;
  }

  if (customClaims?.uri !== undefined) {
    client.customClaims.uri = customClaims.uri;
  }
  if (customClaims?.username !== undefined) {
    client.customClaims.username = customClaims.username;
  }
  if (customClaims?.password !== undefined) {
    client.customClaims.password = customClaims.password;
  }

  if (defaults?.displayMode !== undefined) {
    client.defaults.displayMode = defaults.displayMode;
  }
  if (defaults?.levelOfAssurance !== undefined) {
    client.defaults.levelOfAssurance = defaults.levelOfAssurance;
  }
  if (defaults?.responseMode !== undefined) {
    client.defaults.responseMode = defaults.responseMode;
  }

  if (expiry?.accessToken !== undefined) {
    client.expiry.accessToken = expiry.accessToken;
  }
  if (expiry?.idToken !== undefined) {
    client.expiry.idToken = expiry.idToken;
  }
  if (expiry?.refreshToken !== undefined) {
    client.expiry.refreshToken = expiry.refreshToken;
  }

  if (idTokenEncryption?.algorithm !== undefined) {
    client.idTokenEncryption.algorithm = idTokenEncryption.algorithm;
  }
  if (idTokenEncryption?.encryptionKeyAlgorithm !== undefined) {
    client.idTokenEncryption.encryptionKeyAlgorithm = idTokenEncryption.encryptionKeyAlgorithm;
  }

  if (active !== undefined) {
    client.active = active;
  }
  if (backchannelLogoutUri !== undefined) {
    client.backchannelLogoutUri = backchannelLogoutUri;
  }
  if (description !== undefined) {
    client.description = description;
  }
  if (domain !== undefined) {
    client.domain = domain;
  }
  if (frontChannelLogoutUri !== undefined) {
    client.frontChannelLogoutUri = frontChannelLogoutUri;
  }
  if (jwks !== undefined) {
    client.jwks = jwks;
  }
  if (jwksUri !== undefined) {
    client.jwksUri = jwksUri;
  }
  if (logoUri !== undefined) {
    client.logoUri = logoUri;
  }
  if (name !== undefined) {
    client.name = name;
  }
  if (postLogoutUris !== undefined) {
    client.postLogoutUris = postLogoutUris;
  }
  if (profile !== undefined) {
    client.profile = profile;
  }
  if (redirectUris !== undefined) {
    client.redirectUris = redirectUris;
  }
  if (requiredScopes !== undefined) {
    client.requiredScopes = requiredScopes;
  }
  if (rtbfUri !== undefined) {
    client.rtbfUri = rtbfUri;
  }
  if (scopeDescriptions !== undefined) {
    client.scopeDescriptions = scopeDescriptions;
  }
  if (trusted !== undefined) {
    client.trusted = trusted;
  }
  if (type !== undefined) {
    client.type = type;
  }

  await clientRepository.update(client);
};
