import { ERROR_REDIRECT_URI } from "../../../constant";
import { Router, redirectErrorMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { authorizationSessionEntityMiddleware, clientEntityMiddleware } from "../../../middleware";
import { verifyAuthorizationController, verifyAuthorizationSchema } from "../../../controller";

const router = new Router<any, any>();
export default router;

router.get(
  "/verify",
  redirectErrorMiddleware({ path: "data.redirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(verifyAuthorizationSchema),
  authorizationSessionEntityMiddleware("data.session"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(verifyAuthorizationController),
);
