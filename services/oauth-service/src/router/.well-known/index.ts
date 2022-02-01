import { Context } from "../../types";
import { GrantType, ResponseType, Scope } from "../../common";
import { HttpStatus, Router } from "@lindorm-io/koa";
import { configuration } from "../../configuration";

const router = new Router<unknown, Context>();
export default router;

router.get("/openid-configuration", async (ctx: Context): Promise<void> => {
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
    issuer: configuration.server.host,
    jwksUri: new URL("/.well-known/jwks.json", configuration.server.host).toString(),
    logoutEndpoint: new URL("/oauth2/sessions/logout", configuration.server.host).toString(),
    requestParameterSupported: false,
    requestUriParameterSupported: true,
    responseTypesSupported: Object.values(ResponseType),
    revokeEndpoint: new URL("/oauth2/sessions/revoke", configuration.server.host).toString(),
    scopesSupported: [
      Scope.ADDRESS,
      Scope.EMAIL,
      Scope.OFFLINE_ACCESS,
      Scope.OPENID,
      Scope.PHONE,
      Scope.PROFILE,
    ],
    subjectTypesSupported: ["identity", "client"],
    tokenEndpoint: new URL("/oauth2/token", configuration.server.host).toString(),
    tokenEndpointAuthMethodsSupported: [],
    tokenEndpointAuthSigningAlgValuesSupported: ["ES512", "RS512"],
    tokeninfoEndpoint: new URL("/tokeninfo", configuration.server.host).toString(),
    userinfoEndpoint: new URL("/userinfo", configuration.server.host).toString(),
  };
  ctx.status = HttpStatus.Success.OK;
});

router.get("/jwks.json", async (ctx: Context): Promise<void> => {
  ctx.body = {
    keys: ctx.keystore.getJWKS(),
  };
  ctx.status = HttpStatus.Success.OK;
});
