import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  getAuthenticationTokenSessionController,
  getAuthenticationTokenSessionSchema,
} from "../../../controller";
import {
  authenticationTokenSessionEntityMiddleware,
  clientEntityMiddleware,
  tenantEntityMiddleware,
} from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getAuthenticationTokenSessionSchema),
  authenticationTokenSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authenticationTokenSession.clientId"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(getAuthenticationTokenSessionController),
);
