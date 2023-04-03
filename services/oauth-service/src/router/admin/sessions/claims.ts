import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { getClaimsSessionController, getClaimsSessionSchema } from "../../../controller";
import {
  claimsSessionEntityMiddleware,
  clientEntityMiddleware,
  tenantEntityMiddleware,
} from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getClaimsSessionSchema),
  claimsSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.claimsSession.clientId"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(getClaimsSessionController),
);
