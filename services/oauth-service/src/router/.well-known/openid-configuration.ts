import { ServerKoaContext } from "../../types";
import { GrantType, ResponseType, Scope } from "../../common";
import { HttpStatus, Router } from "@lindorm-io/koa";
import { configuration } from "../../server/configuration";

const router = new Router();
export default router;

router.get("/", async (ctx: ServerKoaContext): Promise<void> => {
  ctx.body = {
    authorizationEndpoint: new URL("/oauth2/authorize", configuration.server.host).toString(),
    backchannelLogoutSessionSupported: true,
    backchannelLogoutSupported: true,
    claimsParameterSupported: false,
    grantTypesSupported: [
      GrantType.AUTHORIZATION_CODE,
      GrantType.CLIENT_CREDENTIALS,
      GrantType.REFRESH_TOKEN,
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
      ResponseType.CODE,
      ResponseType.ID_TOKEN,
      ResponseType.TOKEN,

      [ResponseType.CODE, ResponseType.ID_TOKEN].join(" "),
      [ResponseType.CODE, ResponseType.TOKEN].join(" "),
      [ResponseType.ID_TOKEN, ResponseType.TOKEN].join(" "),

      [ResponseType.CODE, ResponseType.ID_TOKEN, ResponseType.TOKEN].join(" "),
    ],
    revokeEndpoint: new URL("/oauth2/sessions/revoke", configuration.server.host).toString(),
    scopesSupported: [
      Scope.OPENID,
      Scope.ADDRESS,
      Scope.EMAIL,
      Scope.PHONE,
      Scope.PROFILE,

      Scope.ACCESSIBILITY,
      Scope.CONNECTED_PROVIDERS,
      Scope.NATIONAL_IDENTITY_NUMBER,
      Scope.SOCIAL_SECURITY_NUMBER,
      Scope.USERNAME,

      Scope.OFFLINE_ACCESS,
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
