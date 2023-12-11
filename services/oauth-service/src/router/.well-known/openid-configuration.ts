import {
  OpenIdBackchannelAuthMode,
  OpenIdGrantType,
  OpenIdResponseType,
  Scope,
} from "@lindorm-io/common-enums";
import { HttpStatus, Router } from "@lindorm-io/koa";
import { createBaseUrl } from "@lindorm-io/url";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";

export const router = new Router<any, any>();

router.get("/", async (ctx: ServerKoaContext): Promise<void> => {
  const createURL = (path: string): string =>
    new URL(
      path,
      createBaseUrl({
        host: configuration.server.host,
        port: configuration.server.port,
      }),
    ).toString();

  ctx.body = {
    authorizationEndpoint: createURL("/oauth2/authorize"),
    backchannelAuthenticationEndpoint: createURL("/oauth2/backchannel"),
    backchannelAuthenticationRequestSigningAlgValuesSupported: [],
    backchannelLogoutSessionSupported: true,
    backchannelLogoutSupported: true,
    backchannelTokenDeliveryModesSupported: [OpenIdBackchannelAuthMode.POLL],
    backchannelUserCodeParameterSupported: false,
    claimsParameterSupported: false,
    claimsSupported: [
      "aal",
      "acr",
      "address",
      "amr",
      "aud",
      "auth_time",
      "azp",
      "birth_date",
      "display_name",
      "email",
      "email_verified",
      "exp",
      "ext",
      "family_name",
      "gender",
      "given_name",
      "avatar_uri",
      "iat",
      "iss",
      "jti",
      "loa",
      "locale",
      "middle_name",
      "name",
      "national_identity_number",
      "national_identity_number_verified",
      "nbf",
      "nickname",
      "nonce",
      "phone_number",
      "phone_number_verified",
      "picture",
      "preferred_accessibility",
      "preferred_username",
      "profile",
      "pronouns",
      "scp",
      "sid",
      "sih",
      "social_security_number",
      "social_security_number_verified",
      "sub",
      "suh",
      "taken_name",
      "tid",
      "token_type",
      "usr",
      "website",
      "zone_info",
    ],
    endSessionEndpoint: createURL("/oauth2/sessions/logout"),
    exchangeEndpoint: createURL("/exchange"),
    grantTypesSupported: Object.values(OpenIdGrantType).sort(),
    idTokenEncryptionAlgValuesSupported: [],
    idTokenEncryptionEncValuesSupported: [],
    idTokenSigningAlgValuesSupported: ["ES512", "RS512"],
    introspectEndpoint: createURL("/introspect"),
    issuer: configuration.server.issuer,
    jwksUri: createURL("/.well-known/jwks.json"),
    logoutEndpoint: createURL("/oauth2/sessions/logout"),
    requestParameterSupported: false,
    requestUriParameterSupported: true,
    responseTypesSupported: [
      OpenIdResponseType.CODE,
      OpenIdResponseType.ID_TOKEN,
      OpenIdResponseType.TOKEN,

      [OpenIdResponseType.CODE, OpenIdResponseType.ID_TOKEN].join(" "),
      [OpenIdResponseType.CODE, OpenIdResponseType.TOKEN].join(" "),
      [OpenIdResponseType.ID_TOKEN, OpenIdResponseType.TOKEN].join(" "),

      [OpenIdResponseType.CODE, OpenIdResponseType.ID_TOKEN, OpenIdResponseType.TOKEN].join(" "),
    ],
    revokeEndpoint: createURL("/oauth2/sessions/revoke"),
    rightToBeForgottenEndpoint: createURL("/rtbf"),
    scopesSupported: Object.values(Scope).sort(),
    subjectTypesSupported: ["identity", "client"],
    tokenEndpoint: createURL("/oauth2/token"),
    tokenEndpointAuthMethodsSupported: ["client_secret_basic", "client_secret_post"],
    tokenEndpointAuthSigningAlgValuesSupported: ["ES512", "RS512"],
    tokenHeaderTypesSupported: ["JWT", "OPAQUE"],
    userinfoEndpoint: createURL("/userinfo"),
  };

  ctx.status = HttpStatus.Success.OK;
});
