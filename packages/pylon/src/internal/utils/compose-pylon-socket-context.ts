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
  let args: any;

  if (options.args.length === 1 && isObject(options.args[0])) {
    args = changeKeys(options.args[0], "camel");
  } else {
    args = options.args;
  }

  return {
    args,
    event: options.event,
    eventId: randomUUID(),
    io,
    socket,
  };
};
