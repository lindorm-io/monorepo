import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { getAuthorizationController, getAuthorizationSchema } from "../../../controller";
import {
  authorizationSessionEntityMiddleware,
  clientAuthMiddleware,
  clientEntityMiddleware,
} from "../../../middleware";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getAuthorizationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(getAuthorizationController),
);
