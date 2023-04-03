import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { deviceHeadersEnrolledSchema } from "../schema";
import {
  deleteDeviceLinkController,
  deleteDeviceLinkSchema,
  getDeviceLinkInfoController,
  getDeviceLinkInfoSchema,
  getDeviceLinkListController,
  updateDeviceLinkBiometryController,
  updateDeviceLinkBiometrySchema,
  updateDeviceLinkPincodeController,
  updateDeviceLinkPincodeSchema,
  updateDeviceLinkTrustedController,
  updateDeviceLinkTrustedSchema,
} from "../controller";
import {
  challengeConfirmationTokenMiddleware,
  deviceLinkEntityMiddleware,
  identityAuthMiddleware,
} from "../middleware";

export const router = new Router<any, any>();

router.use(identityAuthMiddleware());

router.get("/", useController(getDeviceLinkListController));

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getDeviceLinkInfoSchema),
  deviceLinkEntityMiddleware("data.id"),
  useController(getDeviceLinkInfoController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteDeviceLinkSchema),
  deviceLinkEntityMiddleware("data.id"),
  useController(deleteDeviceLinkController),
);

router.put(
  "/:id/biometry",
  paramsMiddleware,
  useSchema(updateDeviceLinkBiometrySchema),
  useSchema(deviceHeadersEnrolledSchema, "headers"),
  challengeConfirmationTokenMiddleware("data.challengeConfirmationToken"),
  deviceLinkEntityMiddleware("data.id"),
  useController(updateDeviceLinkBiometryController),
);

router.put(
  "/:id/pincode",
  paramsMiddleware,
  useSchema(updateDeviceLinkPincodeSchema),
  useSchema(deviceHeadersEnrolledSchema, "headers"),
  challengeConfirmationTokenMiddleware("data.challengeConfirmationToken"),
  deviceLinkEntityMiddleware("data.id"),
  useController(updateDeviceLinkPincodeController),
);

router.put(
  "/:id/trusted",
  paramsMiddleware,
  useSchema(updateDeviceLinkTrustedSchema),
  useSchema(deviceHeadersEnrolledSchema, "headers"),
  challengeConfirmationTokenMiddleware("data.challengeConfirmationToken"),
  deviceLinkEntityMiddleware("data.id"),
  useController(updateDeviceLinkTrustedController),
);
