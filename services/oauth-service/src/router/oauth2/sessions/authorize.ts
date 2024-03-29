import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { ERROR_REDIRECT_URI } from "../../../constant";
import { verifyAuthorizationController, verifyAuthorizationSchema } from "../../../controller";
import { authorizationSessionEntityMiddleware, clientEntityMiddleware } from "../../../middleware";

export const router = new Router<any, any>();

router.get(
  "/verify",
  redirectErrorMiddleware({ path: "data.redirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(verifyAuthorizationSchema),
  authorizationSessionEntityMiddleware("data.session"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(verifyAuthorizationController),
);
