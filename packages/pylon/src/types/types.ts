import { IMessage, SubscribeOptions } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { IJob } from "../interfaces";

export type PylonSubscribeOptions = SubscribeOptions & {
  target: Constructor<IMessage>;
};

export type QueueJobHandler = (job: IJob) => Promise<void>;

export type SearchPath<E extends Constructor> =
  | { [K in keyof InstanceType<E>]?: string }
  | string;
