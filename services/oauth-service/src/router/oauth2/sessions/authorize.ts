import { ERROR_REDIRECT_URI } from "../../../constant";
import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { authorizationSessionEntityMiddleware, clientEntityMiddleware } from "../../../middleware";
import { verifyAuthorizationController, verifyAuthorizationSchema } from "../../../controller";

export const router = new Router<any, any>();

router.get(
  "/verify",
  redirectErrorMiddleware({ path: "data.redirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(verifyAuthorizationSchema),
  authorizationSessionEntityMiddleware("data.session"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(verifyAuthorizationController),
);
