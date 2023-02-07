import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_EMAIL } from "../../common";
import { ServerKoaController } from "../../types";
import { SendOtpRequestBody } from "@lindorm-io/common-types";

type RequestData = SendOtpRequestBody;

export const sendOtpSchema = Joi.object<RequestData>().keys({
  content: Joi.object().required(),
  template: Joi.string().required(),
  to: JOI_EMAIL.required(),
  type: Joi.string().required(),
});

export const sendOtpController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const { data, logger } = ctx;

  logger.debug("Send Otp", data);
};
