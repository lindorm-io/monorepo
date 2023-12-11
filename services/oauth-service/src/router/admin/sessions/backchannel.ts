import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmBackchannelConsentController,
  confirmBackchannelConsentSchema,
  confirmBackchannelLoginController,
  confirmBackchannelLoginSchema,
  getBackchannelController,
  getBackchannelSchema,
  rejectBackchannelController,
  rejectBackchannelSchema,
} from "../../../controller";
import {
  backchannelSessionEntityMiddleware,
  clientEntityMiddleware,
  tenantEntityMiddleware,
} from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getBackchannelSchema),
  backchannelSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.backchannelSession.clientId"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(getBackchannelController),
);

router.post(
  "/:id/consent",
  paramsMiddleware,
  useSchema(confirmBackchannelConsentSchema),
  backchannelSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.backchannelSession.clientId"),
  useController(confirmBackchannelConsentController),
);

router.post(
  "/:id/login",
  paramsMiddleware,
  useSchema(confirmBackchannelLoginSchema),
  backchannelSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.backchannelSession.clientId"),
  useController(confirmBackchannelLoginController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectBackchannelSchema),
  backchannelSessionEntityMiddleware("data.id"),
  useController(rejectBackchannelController),
);
