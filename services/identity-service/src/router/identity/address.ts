import { LindormScopes } from "@lindorm-io/common-types";
import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
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

const router = new Router();
export default router;

router.post(
  "/",
  useSchema(createIdentityAddressSchema),
  identityAuthMiddleware({
    scopes: [LindormScopes.OPENID, LindormScopes.ADDRESS],
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
    scopes: [LindormScopes.OPENID, LindormScopes.ADDRESS],
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
    scopes: [LindormScopes.OPENID, LindormScopes.ADDRESS],
    fromPath: {
      subject: "entity.address.identityId",
    },
  }),
  useController(deleteIdentityAddressController),
);
