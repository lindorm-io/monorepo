export interface IMessage {
  id: string;
  name: string;
  data: Record<string, any>;
  delay: number;
  mandatory: boolean;
  timestamp: Date;
  topic: string;
  type: string;
}
