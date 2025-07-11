import { Options } from "amqplib";

export type PublishOptions = Options.Publish & {
  delay?: number;
  topic?: string;
};

export type PublishWithDelayOptions = Omit<PublishOptions, "delay"> & {
  delay: number;
};
