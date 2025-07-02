import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { IMessage } from "../interfaces";

export type MessageKitOptions<M extends IMessage> = {
  Message: Constructor<M>;
  logger: ILogger;
};

export type TopicNameOptions = {
  namespace?: string | null;
  topic?: string | null;
};
