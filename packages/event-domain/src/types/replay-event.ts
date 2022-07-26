export interface ReplayEventData {
  dropViews?: Array<string>;
  droppedViews?: Array<string>;
  eventStoreTimestamp?: Date;
  lastPublishedEvents?: Array<string>;
  publishedEvents?: number;
  startDate?: Date;
  startDelay?: number;
}
