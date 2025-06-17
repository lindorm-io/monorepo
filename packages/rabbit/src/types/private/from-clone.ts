import { ILogger } from "@lindorm/logger";
import { ChannelModel, ConfirmChannel } from "amqplib";
import { SubscriptionList } from "../../classes/private";
import { RabbitSourceMessage } from "../rabbit-source";

export type FromClone = {
  _mode: "from_clone";
  channelModel: ChannelModel;
  confirmChannel: ConfirmChannel;
  deadletters: string;
  exchange: string;
  logger: ILogger;
  messages: Array<RabbitSourceMessage>;
  nackTimeout: number;
  subscriptions: SubscriptionList;
};
