import { ClientPermission, ClientScope } from "../../common";
import { Context } from "../../types";
import { clientAuthMiddleware, identityEntityMiddleware } from "../../middleware";
import { useController, paramsMiddleware, Router, useSchema } from "@lindorm-io/koa";
import {
  addUserinfoController,
  addUserinfoSchema,
  getUserinfoController,
  getUserinfoSchema,
} from "../../controller";

const router = new Router<unknown, Context>();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.IDENTITY_CONFIDENTIAL],
    scopes: [ClientScope.IDENTITY_IDENTITY_READ],
  }),

  useSchema(getUserinfoSchema),
  identityEntityMiddleware("data.id"),
  useController(getUserinfoController),
);

router.put(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.IDENTITY_CONFIDENTIAL],
    scopes: [ClientScope.IDENTITY_IDENTITY_WRITE],
  }),

  useSchema(addUserinfoSchema),
  identityEntityMiddleware("data.id"),
  useController(addUserinfoController),
);
