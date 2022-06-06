import { IdentityPermission, Scope } from "../common";
import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { ServerKoaContext } from "../types";
import { identifierEntityMiddleware, identityAuthMiddleware } from "../middleware";
import { paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  deleteIdentifierController,
  deleteIdentifierSchema,
  updateIdentifierController,
  updateIdentifierSchema,
} from "../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(updateIdentifierSchema),
  identifierEntityMiddleware("data.id"),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
    fromPath: {
      subject: "entity.identifier.identityId",
    },
  }),
  useController(updateIdentifierController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteIdentifierSchema),
  identifierEntityMiddleware("data.id"),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
    fromPath: {
      subject: "entity.identifier.identityId",
    },
  }),
  useController(deleteIdentifierController),
);
