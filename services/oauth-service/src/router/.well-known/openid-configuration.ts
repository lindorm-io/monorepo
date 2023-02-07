import { ServerKoaContext } from "../../types";
import { HttpStatus, Router } from "@lindorm-io/koa";
import { configuration } from "../../server/configuration";
import { LindormScopes, OauthGrantTypes, OauthResponseTypes } from "@lindorm-io/common-types";

const router = new Router();
export default router;

router.get("/", async (ctx: ServerKoaContext): Promise<void> => {
  ctx.body = {
    authorizationEndpoint: new URL("/oauth2/authorize", configuration.server.host).toString(),
    backchannelLogoutSessionSupported: true,
    backchannelLogoutSupported: true,
    claimsParameterSupported: false,
    grantTypesSupported: [
      OauthGrantTypes.AUTHORIZATION_CODE,
      OauthGrantTypes.CLIENT_CREDENTIALS,
      OauthGrantTypes.REFRESH_TOKEN,
    ],
    idTokenEncryptionAlgValuesSupported: [],
    idTokenEncryptionEncValuesSupported: [],
    idTokenSigningAlgValuesSupported: ["ES512", "RS512"],
    issuer: configuration.server.issuer,
    jwksUri: new URL("/.well-known/jwks.json", configuration.server.host).toString(),
    logoutEndpoint: new URL("/oauth2/sessions/logout", configuration.server.host).toString(),
    requestParameterSupported: false,
    requestUriParameterSupported: true,
    responseTypesSupported: [
      OauthResponseTypes.CODE,
      OauthResponseTypes.ID_TOKEN,
      OauthResponseTypes.TOKEN,

      [OauthResponseTypes.CODE, OauthResponseTypes.ID_TOKEN].join(" "),
      [OauthResponseTypes.CODE, OauthResponseTypes.TOKEN].join(" "),
      [OauthResponseTypes.ID_TOKEN, OauthResponseTypes.TOKEN].join(" "),

      [OauthResponseTypes.CODE, OauthResponseTypes.ID_TOKEN, OauthResponseTypes.TOKEN].join(" "),
    ],
    revokeEndpoint: new URL("/oauth2/sessions/revoke", configuration.server.host).toString(),
    scopesSupported: [
      LindormScopes.OPENID,
      LindormScopes.ADDRESS,
      LindormScopes.EMAIL,
      LindormScopes.PHONE,
      LindormScopes.PROFILE,

      LindormScopes.ACCESSIBILITY,
      LindormScopes.CONNECTED_PROVIDERS,
      LindormScopes.NATIONAL_IDENTITY_NUMBER,
      LindormScopes.PUBLIC,
      LindormScopes.SOCIAL_SECURITY_NUMBER,
      LindormScopes.USERNAME,

      LindormScopes.OFFLINE_ACCESS,
    ],
    subjectTypesSupported: ["identity", "client"],
    tokenEndpoint: new URL("/oauth2/token", configuration.server.host).toString(),
    tokenEndpointAuthMethodsSupported: ["client_secret_basic", "client_secret_post"],
    tokenEndpointAuthSigningAlgValuesSupported: ["ES512", "RS512"],
    tokeninfoEndpoint: new URL("/tokeninfo", configuration.server.host).toString(),
    userinfoEndpoint: new URL("/userinfo", configuration.server.host).toString(),
  };
  ctx.status = HttpStatus.Success.OK;
});
