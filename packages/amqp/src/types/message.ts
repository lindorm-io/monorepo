export interface IMessage {
  id: string;
  name: string;
  data: Record<string, any>;
  delay: number;
  mandatory: boolean;
  routingKey: string;
  timestamp: Date;
  type: string;
}
