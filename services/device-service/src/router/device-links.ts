import { Router, paramsMiddleware, useAssertion, useController, useSchema } from "@lindorm-io/koa";
import {
  getDeviceLinkInfoController,
  getDeviceLinkListController,
  getDeviceLinkInfoSchema,
  deleteDeviceLinkController,
  deleteDeviceLinkSchema,
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

const router = new Router();
export default router;

router.use(identityAuthMiddleware());

router.get("/", useController(getDeviceLinkListController));

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getDeviceLinkInfoSchema),
  deviceLinkEntityMiddleware("data.id"),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.identityId",
      actual: "token.bearerToken.subject",
    },
  }),
  useController(getDeviceLinkInfoController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteDeviceLinkSchema),
  deviceLinkEntityMiddleware("data.id"),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.identityId",
      actual: "token.bearerToken.subject",
    },
  }),
  useController(deleteDeviceLinkController),
);

router.put(
  "/:id/biometry",
  paramsMiddleware,
  useSchema(updateDeviceLinkBiometrySchema),
  challengeConfirmationTokenMiddleware("data.challengeConfirmationToken"),
  deviceLinkEntityMiddleware("data.id"),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.identityId",
      actual: "token.bearerToken.subject",
    },
  }),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.challengeConfirmationToken.claims.deviceLinkId",
    },
    hint: "deviceLinkId",
  }),
  useController(updateDeviceLinkBiometryController),
);

router.put(
  "/:id/pincode",
  paramsMiddleware,
  useSchema(updateDeviceLinkPincodeSchema),
  challengeConfirmationTokenMiddleware("data.challengeConfirmationToken"),
  deviceLinkEntityMiddleware("data.id"),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.identityId",
      actual: "token.bearerToken.subject",
    },
  }),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.challengeConfirmationToken.claims.deviceLinkId",
    },
    hint: "deviceLinkId",
  }),
  useController(updateDeviceLinkPincodeController),
);

router.put(
  "/:id/trusted",
  paramsMiddleware,
  useSchema(updateDeviceLinkTrustedSchema),
  challengeConfirmationTokenMiddleware("data.challengeConfirmationToken"),
  deviceLinkEntityMiddleware("data.id"),
  useAssertion({
    fromPath: {
      expect: "entity.deviceLink.identityId",
      actual: "token.bearerToken.subject",
    },
  }),
  useAssertion({
    expect: false,
    fromPath: {
      actual: "entity.deviceLink.trusted",
    },
    hint: "trusted",
  }),
  useController(updateDeviceLinkTrustedController),
);
