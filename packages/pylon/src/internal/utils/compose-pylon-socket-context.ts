import { changeKeys } from "@lindorm/case";
import { isObject } from "@lindorm/is";
import { randomUUID } from "crypto";
import {
  IoServer,
  PylonEnvelopeHeader,
  PylonSocket,
  PylonSocketContextBase,
  PylonSocketData,
} from "../../types";

type Options = {
  args: Array<any>;
  event: string;
};

const isPylonEnvelope = (data: any): boolean => isObject(data) && data.__pylon === true;

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
  let envelope = false;
  let header: PylonEnvelopeHeader = {};

  const firstArg = eventArgs[0];

  if (eventArgs.length === 1 && isPylonEnvelope(firstArg)) {
    envelope = true;
    header = isObject(firstArg.header) ? changeKeys(firstArg.header, "camel") : {};
    const payload = firstArg.payload;
    args = isObject(payload) ? changeKeys(payload, "camel") : (payload ?? {});
  } else if (eventArgs.length === 1 && isObject(firstArg)) {
    args = changeKeys(firstArg, "camel");
  } else {
    args = eventArgs;
  }

  return {
    ack: rawAck ? (data: any) => rawAck({ __pylon: true, ok: true, data }) : null,
    args,
    data: args,
    envelope,
    event: options.event,
    eventId: randomUUID(),
    header,
    io,
    nack: rawAck ? (error: any) => rawAck({ __pylon: true, ok: false, error }) : null,
    params: {},
    socket,
  };
};
