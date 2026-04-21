import { PylonListener } from "../../classes/index.js";
import type { EventSegment } from "../classes/EventMatcher.js";
import type { PylonSocketContext, PylonSocketMiddleware } from "../../types/index.js";

const JOIN_SEGMENTS: Array<EventSegment> = [
  { type: "literal", value: "rooms" },
  { type: "param", value: "roomId" },
  { type: "literal", value: "join" },
];

const LEAVE_SEGMENTS: Array<EventSegment> = [
  { type: "literal", value: "rooms" },
  { type: "param", value: "roomId" },
  { type: "literal", value: "leave" },
];

const joinHandler: PylonSocketMiddleware<any> = async (ctx) => {
  try {
    await ctx.rooms!.join(ctx.params.roomId);
    ctx.ack?.({ room: ctx.params.roomId });
  } catch (error) {
    ctx.nack?.(
      error instanceof Error
        ? { code: "room_join_failed", message: error.message }
        : error,
    );
  }
};

const leaveHandler: PylonSocketMiddleware<any> = async (ctx) => {
  try {
    await ctx.rooms!.leave(ctx.params.roomId);
    ctx.ack?.({ room: ctx.params.roomId });
  } catch (error) {
    ctx.nack?.(
      error instanceof Error
        ? { code: "room_leave_failed", message: error.message }
        : error,
    );
  }
};

export const createBuiltInRoomListeners = <C extends PylonSocketContext>(): Array<
  PylonListener<C>
> => {
  const listener = new PylonListener<C>();

  listener._addScannedListener("rooms::roomId:join", "on", JOIN_SEGMENTS, [
    joinHandler as PylonSocketMiddleware<C>,
  ]);

  listener._addScannedListener("rooms::roomId:leave", "on", LEAVE_SEGMENTS, [
    leaveHandler as PylonSocketMiddleware<C>,
  ]);

  return [listener];
};
