import { ILogger } from "@lindorm/logger";
import { ConfirmChannel, Connection } from "amqplib";
import { SubscriptionList } from "../../classes/private";
import { RabbitSourceMessage } from "../rabbit-source";

export type FromClone = {
  _mode: "from_clone";
  confirmChannel: ConfirmChannel;
  connection: Connection;
  deadletters: string;
  exchange: string;
  logger: ILogger;
  messages: Array<RabbitSourceMessage>;
  nackTimeout: number;
  subscriptions: SubscriptionList;
};
