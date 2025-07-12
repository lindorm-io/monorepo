import { ILogger } from "@lindorm/logger";
import { IMessage, IMessageSubscriptions } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { ChannelModel, ConfirmChannel } from "amqplib";
import { IRabbitMessageBus } from "../../interfaces";

export type FromClone = {
  _mode: "from_clone";
  cache: Map<Constructor<IMessage>, IRabbitMessageBus<IMessage>>;
  channelModel: ChannelModel;
  confirmChannel: ConfirmChannel;
  deadletters: string;
  exchange: string;
  logger: ILogger;
  messages: Array<Constructor<IMessage>>;
  nackTimeout: number;
  subscriptions: IMessageSubscriptions;
};
