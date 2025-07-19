import { IMessage } from "@lindorm/message";
import { DeepPartial } from "@lindorm/types";
import { PublishOptions } from "../types";

export interface IKafkaPublisher<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> {
  create(options: O | M): M;
  copy(message: M): M;
  publish(message: O | M | Array<O | M>, options?: PublishOptions): Promise<void>;
}
