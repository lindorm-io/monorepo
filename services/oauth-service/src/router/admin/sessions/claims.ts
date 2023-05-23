import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { getClaimsRequestController, getClaimsRequestSchema } from "../../../controller";
import {
  ClaimsRequestEntityMiddleware,
  clientEntityMiddleware,
  tenantEntityMiddleware,
} from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getClaimsRequestSchema),
  ClaimsRequestEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.claimsRequest.clientId"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(getClaimsRequestController),
);
