export type PublishOptions = {
  correlationId?: string;
  delay?: number;
  messageId?: string;
  timestamp?: number;
  topic?: string;
};

export type PublishWithDelayOptions = Omit<PublishOptions, "delay"> & {
  delay: number;
};
