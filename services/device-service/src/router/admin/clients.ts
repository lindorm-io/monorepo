import { paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import Router from "koa-router";
import {
  createClientController,
  createClientSchema,
  deleteClientController,
  deleteClientSchema,
  getClientController,
  getClientSchema,
  updateClientController,
  updateClientPublicKeyController,
  updateClientPublicKeySchema,
  updateClientSchema,
} from "../../controller/client";
import { clientEntityMiddleware, publicKeyEntityMiddleware } from "../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post("/", useSchema(createClientSchema), useController(createClientController));

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getClientSchema),
  clientEntityMiddleware("data.id"),
  useController(getClientController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(updateClientSchema),
  clientEntityMiddleware("data.id"),
  useController(updateClientController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteClientSchema),
  clientEntityMiddleware("data.id"),
  publicKeyEntityMiddleware("entity.client.publicKeyId"),
  useController(deleteClientController),
);

router.put(
  "/:id/public-key",
  paramsMiddleware,
  useSchema(updateClientPublicKeySchema),
  clientEntityMiddleware("data.id"),
  publicKeyEntityMiddleware("entity.client.publicKeyId"),
  useController(updateClientPublicKeyController),
);
