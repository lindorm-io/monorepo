import { ClientError } from "@lindorm/errors";
import { isUrlLike } from "@lindorm/is";
import { PylonRouter } from "../../classes/index.js";
import type { PylonHttpContext, PylonHttpSettings } from "../../types/index.js";
import { assertSecurityTxtOptions } from "./assert-security-txt-options.js";
import { renderSecurityTxt } from "./render-security-txt.js";

export const createWellKnownRouter = <C extends PylonHttpContext>(
  options: PylonHttpSettings<C>,
): PylonRouter<C> => {
  const router = new PylonRouter<C>();

  router.get("/change-password", async (ctx) => {
    if (!isUrlLike(options.changePasswordUri)) {
      throw new ClientError("Change password URI is not configured", {
        code: "change_password_uri_not_configured",
        title: "Change Password URI Not Configured",
        details:
          "This server has no changePasswordUri configured for the well-known redirect.",
        type: "urn:lindorm:pylon:error:change_password_uri_not_configured",
        status: ClientError.Status.NotFound,
      });
    }
    ctx.redirect(options.changePasswordUri);
  });

  router.get("/jwks.json", async (ctx) => {
    ctx.body = ctx.amphora.jwks;
    ctx.status = 200;
  });

  router.get("/oauth-protected-resource", async (ctx) => {
    if (!isUrlLike(options.domain)) {
      throw new ClientError("Domain is not configured", {
        code: "domain_not_configured",
        title: "Domain Not Configured",
        details:
          "This server has no domain configured to use as its resource identifier.",
        type: "urn:lindorm:pylon:error:domain_not_configured",
        status: ClientError.Status.NotFound,
      });
    }

    if (!isUrlLike(options.auth?.issuer)) {
      throw new ClientError("Auth issuer is not configured", {
        code: "auth_issuer_not_configured",
        title: "Auth Issuer Not Configured",
        details:
          "This server has no auth issuer configured for the protected resource metadata.",
        type: "urn:lindorm:pylon:error:auth_issuer_not_configured",
        status: ClientError.Status.NotFound,
      });
    }

    // RFC 9728 §2 — protected resource metadata. `resource` (this server's own
    // resource identifier) is the only REQUIRED member; `authorization_servers`
    // lists the issuers that can mint tokens for it. Wire names stay snake_case.
    ctx.body = {
      resource: options.domain,
      authorization_servers: [options.auth.issuer],
    };
    ctx.status = 200;
  });

  router.get("/right-to-be-forgotten", async (ctx) => {
    if (ctx.state.authorization.type !== "bearer") {
      throw new ClientError("Bearer authorization is required", {
        code: "bearer_authorization_required",
        title: "Bearer Authorization Required",
        type: "urn:lindorm:pylon:error:bearer_authorization_required",
        details: "Right to be forgotten requires Bearer authorization",
        data: { authorizationType: ctx.state.authorization.type },
        status: ClientError.Status.Unauthorized,
      });
    }

    if (options.callbacks?.rightToBeForgotten) {
      await options.callbacks.rightToBeForgotten(ctx);
    }

    ctx.body = undefined;
    ctx.status = 204;
  });

  if (options.securityTxt) {
    assertSecurityTxtOptions(options.securityTxt);

    const body = renderSecurityTxt(options.securityTxt);

    router.get("/security.txt", async (ctx) => {
      ctx.type = "text/plain; charset=utf-8";
      ctx.body = body;
      ctx.status = 200;
    });
  }

  return router;
};
