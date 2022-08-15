import Joi from "joi";
import { ISubscription } from "@lindorm-io/amqp";

export const JOI_SUBSCRIPTION = Joi.object<ISubscription>().keys({
  callback: Joi.function().required(),
  queue: Joi.string().required(),
  topic: Joi.string().required(),
});
