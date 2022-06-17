import { ServerKoaContext } from "../../../types";
import { ClientPermission } from "../../../common";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  authorizationSessionEntityMiddleware,
  browserSessionEntityMiddleware,
  clientAuthMiddleware,
  clientEntityMiddleware,
  consentSessionEntityMiddleware,
} from "../../../middleware";
import {
  confirmConsentController,
  confirmConsentSchema,
  getConsentInfoController,
  getConsentInfoSchema,
  rejectConsentController,
  rejectConsentSchema,
  skipConsentController,
  skipConsentSchema,
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
  useSchema(getConsentInfoSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(getConsentInfoController),
);

router.put(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  consentSessionEntityMiddleware("entity.authorizationSession.consentSessionId"),
  useController(confirmConsentController),
);

router.put(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectConsentController),
);

router.put(
  "/:id/skip",
  paramsMiddleware,
  useSchema(skipConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  consentSessionEntityMiddleware("entity.authorizationSession.consentSessionId"),
  useController(skipConsentController),
);
