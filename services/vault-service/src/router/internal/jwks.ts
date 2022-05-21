import { ClientPermission, ClientScope } from "../../common";
import { Router, useController } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware } from "../../middleware";
import { getPrivateJwksController, getPublicJwksController } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/private",
  clientAuthMiddleware({
    permissions: [ClientPermission.VAULT_CONFIDENTIAL],
    scopes: [ClientScope.VAULT_JWKS_PRIVATE_READ],
  }),
  useController(getPrivateJwksController),
);

router.get(
  "/",
  clientAuthMiddleware({
    permissions: [ClientPermission.VAULT_CONFIDENTIAL],
    scopes: [ClientScope.VAULT_JWKS_PUBLIC_READ],
  }),
  useController(getPublicJwksController),
);
