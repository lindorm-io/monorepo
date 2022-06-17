import { ClientPermission } from "../../common";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware, identityEntityMiddleware } from "../../middleware";
import { useController, paramsMiddleware, Router, useSchema } from "@lindorm-io/koa";
import {
  addUserinfoController,
  addUserinfoSchema,
  getUserinfoController,
  getUserinfoSchema,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.IDENTITY_CONFIDENTIAL],
  }),
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getUserinfoSchema),
  identityEntityMiddleware("data.id"),
  useController(getUserinfoController),
);

router.put(
  "/:id",
  paramsMiddleware,
  useSchema(addUserinfoSchema),
  identityEntityMiddleware("data.id"),
  useController(addUserinfoController),
);
