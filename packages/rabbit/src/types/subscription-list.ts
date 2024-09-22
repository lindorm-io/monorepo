export type FindSubscription = {
  queue: string;
  topic: string;
};

export type RemoveSubscription = {
  consumerTag: string;
};
