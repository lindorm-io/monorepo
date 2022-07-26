export interface ReplayEventData {
  dropView: {
    completed: Array<string>;
    delay: number;
    remaining: Array<string>;
  };
  error?: Error;
  moveView: {
    completed: Array<string>;
    delay: number;
    remaining: Array<string>;
    suffix: string;
  };
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
