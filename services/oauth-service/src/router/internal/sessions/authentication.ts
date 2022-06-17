import { ServerKoaContext } from "../../../types";
import { ClientPermission } from "../../../common";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  authorizationSessionEntityMiddleware,
  browserSessionEntityMiddleware,
  clientAuthMiddleware,
  clientEntityMiddleware,
} from "../../../middleware";
import {
  confirmAuthenticationController,
  confirmAuthenticationSchema,
  getAuthenticationInfoController,
  getAuthenticationInfoSchema,
  rejectAuthenticationController,
  rejectAuthenticationSchema,
  skipAuthenticationController,
  skipAuthenticationSchema,
} from "../../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
  }),
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getAuthenticationInfoSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(getAuthenticationInfoController),
);

router.put(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmAuthenticationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  useController(confirmAuthenticationController),
);

router.put(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectAuthenticationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectAuthenticationController),
);

router.put(
  "/:id/skip",
  paramsMiddleware,
  useSchema(skipAuthenticationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  useController(skipAuthenticationController),
);
