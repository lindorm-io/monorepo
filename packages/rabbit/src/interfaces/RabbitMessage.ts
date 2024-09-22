export interface IRabbitMessage {
  id: string;
  delay: number;
  mandatory: boolean;
  timestamp: Date;
  topic: string;
  type: string;
}
