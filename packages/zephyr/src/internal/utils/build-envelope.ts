import type { ZephyrContext } from "../../types/context";
import type { PylonEnvelope } from "../../types/pylon-envelope";

export const buildEnvelope = (ctx: ZephyrContext): PylonEnvelope => ({
  __pylon: true,
  header: {
    correlationId: ctx.metadata.correlationId,
    ...ctx.outgoing.header,
  },
  payload: ctx.outgoing.data,
});
