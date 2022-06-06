import { IdentityPermission, Scope } from "../../common";
import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { ServerKoaContext } from "../../types";
import { paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  addressEntityMiddleware,
  identityAuthMiddleware,
  identityEntityMiddleware,
} from "../../middleware";
import {
  createIdentityAddressController,
  createIdentityAddressSchema,
  deleteIdentityAddressController,
  deleteIdentityAddressSchema,
  updateIdentityAddressController,
  updateIdentityAddressSchema,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(createIdentityAddressSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(createIdentityAddressController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(updateIdentityAddressSchema),
  addressEntityMiddleware("data.id"),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
    fromPath: {
      subject: "entity.address.identityId",
    },
  }),
  useController(updateIdentityAddressController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteIdentityAddressSchema),
  addressEntityMiddleware("data.id"),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
    fromPath: {
      subject: "entity.address.identityId",
    },
  }),
  useController(deleteIdentityAddressController),
);
