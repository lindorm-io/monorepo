export interface IMessage {
  id: string;
  delay: number;
  mandatory: boolean;
  routingKey: string;
  type: string;
}
