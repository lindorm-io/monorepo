import { Router, useController, useSchema } from "@lindorm-io/koa";
import { initialiseRdcController, initialiseRdcSchema } from "../../controller";
import { assertSignatureClientMiddleware, signatureMiddleware } from "../../middleware";
import { signatureHeadersSchema } from "../../schema";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/",
  useSchema(initialiseRdcSchema),
  useSchema(signatureHeadersSchema, "headers"),
  signatureMiddleware,
  assertSignatureClientMiddleware,
  useController(initialiseRdcController),
);
