export interface ReplayEventData {
  error?: Error;
  publishEvents: {
    amount: number;
    contexts: Array<string>;
    delay: number;
    previous: Array<string>;
    timestamp?: Date;
  };
  start: {
    delay: number;
    timestamp: Date;
  };
}
