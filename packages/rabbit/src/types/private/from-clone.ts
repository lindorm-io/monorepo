import { ILogger } from "@lindorm/logger";
import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { ChannelModel, ConfirmChannel } from "amqplib";
import { SubscriptionList } from "../../classes/private";

export type FromClone = {
  _mode: "from_clone";
  channelModel: ChannelModel;
  confirmChannel: ConfirmChannel;
  deadletters: string;
  exchange: string;
  logger: ILogger;
  messages: Array<Constructor<IMessage>>;
  nackTimeout: number;
  subscriptions: SubscriptionList;
};
