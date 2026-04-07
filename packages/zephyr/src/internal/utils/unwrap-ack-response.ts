import { ZephyrError } from "../../errors/ZephyrError";
import type { ZephyrContext } from "../../types/context";
import type { PylonAck } from "../../types/pylon-envelope";

export const unwrapAckResponse = (ctx: ZephyrContext, response: any): void => {
  if (response?.__pylon) {
    const ack = response as PylonAck;

    if (ack.ok) {
      ctx.incoming = { data: ack.data, ok: true };
    } else {
      throw new ZephyrError(ack.error?.message ?? "Request failed", {
        code: ack.error?.code,
        data: ack.error?.data,
        title: ack.error?.title,
      });
    }
  } else {
    ctx.incoming = { data: response, ok: true };
  }
};
