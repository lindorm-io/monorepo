export interface IMessage<TData = any> {
  id: string;
  name: string;
  data: TData;
  delay: number;
  mandatory: boolean;
  timestamp: Date;
  topic: string;
  type: string;
}
