import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { addressEntityMiddleware, identityEntityMiddleware } from "../../middleware";
import {
  addAddressController,
  addAddressSchema,
  deleteAddressController,
  deleteAddressSchema,
  updateAddressController,
  updateAddressSchema,
} from "../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/",
  paramsMiddleware,
  useSchema(addAddressSchema),
  identityEntityMiddleware("data.identityId"),
  useController(addAddressController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(updateAddressSchema),
  addressEntityMiddleware("data.id"),
  identityEntityMiddleware("entity.address.identityId"),
  useController(updateAddressController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteAddressSchema),
  addressEntityMiddleware("data.id"),
  identityEntityMiddleware("entity.address.identityId"),
  useController(deleteAddressController),
);
