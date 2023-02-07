import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { EmitSocketEventRequestBody } from "@lindorm-io/common-types";

type RequestData = EmitSocketEventRequestBody;

export const emitSocketEventSchema = Joi.object<RequestData>().keys({
  channels: Joi.object()
    .keys({
      sessions: Joi.array().items(Joi.string()).optional(),
      deviceLinks: Joi.array().items(Joi.string()).optional(),
      identities: Joi.array().items(Joi.string()).optional(),
    })
    .required(),
  content: Joi.object().required(),
  event: Joi.string().required(),
});

export const emitSocketEventController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    connection: { io },
    data: { channels, content, event },
    logger,
  } = ctx;

  if (channels.identities?.length) {
    io.to(channels.identities).emit(event, content);
  }

  if (channels.deviceLinks?.length) {
    io.to(channels.deviceLinks).emit(event, content);
  }

  if (channels.sessions?.length) {
    io.to(channels.sessions).emit(event, content);
  }

  logger.debug("Emit Socket", ctx.data);
};
