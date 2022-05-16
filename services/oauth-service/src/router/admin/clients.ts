import { ServerKoaContext } from "../../types";
import { IdentityPermission } from "../../common";
import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { updateClientController, updateClientSchema } from "../../controller";
import {
  assertTenantPermissionMiddleware,
  clientEntityMiddleware,
  identityAuthMiddleware,
  tenantEntityMiddleware,
} from "../../middleware";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.patch(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.CLIENT_ADMIN],
  }),
  useSchema(updateClientSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  assertTenantPermissionMiddleware,
  useController(updateClientController),
);
