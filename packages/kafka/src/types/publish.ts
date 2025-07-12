export type PublishOptions = {
  delay?: number;
  key?: string;
  timestamp?: string;
  topic?: string;
};

export type PublishWithDelayOptions = Omit<PublishOptions, "delay"> & {
  delay: number;
};
