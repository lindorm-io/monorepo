import { changeKeys } from "@lindorm/case";
import { isObject } from "@lindorm/is";
import { randomUUID } from "crypto";
import {
  IoServer,
  PylonSocket,
  PylonSocketContextBase,
  PylonSocketData,
} from "../../types";

type Options = {
  args: Array<any>;
  event: string;
};

export const composePylonSocketContextBase = (
  io: IoServer,
  socket: PylonSocket,
  options: Options,
): PylonSocketContextBase<any, PylonSocketData> => {
  const rawArgs = options.args;
  const lastArg = rawArgs[rawArgs.length - 1];
  const rawAck = typeof lastArg === "function" ? lastArg : undefined;
  const eventArgs = rawAck ? rawArgs.slice(0, -1) : rawArgs;

  let args: any;

  if (eventArgs.length === 1 && isObject(eventArgs[0])) {
    args = changeKeys(eventArgs[0], "camel");
  } else {
    args = eventArgs;
  }

  return {
    ack: rawAck ? (data: any) => rawAck({ ok: true, data }) : null,
    args,
    data: args,
    event: options.event,
    eventId: randomUUID(),
    io,
    nack: rawAck ? (error: any) => rawAck({ ok: false, error }) : null,
    params: {},
    socket,
  };
};
