import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { IMessage } from "../interfaces";

export type MessageKitOptions<M extends IMessage> = {
  logger?: ILogger;
  target: Constructor<M>;
};

export type TopicNameOptions = {
  namespace?: string | null;
  topic?: string | null;
};
