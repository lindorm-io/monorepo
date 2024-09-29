import { IRabbitSubscription } from "@lindorm/rabbit";
import { IHermesMessage } from "./HermesMessage";

export interface IHermesMessageBus {
  publish(message: IHermesMessage | Array<IHermesMessage>): Promise<void>;
  subscribe(
    subscription:
      | IRabbitSubscription<IHermesMessage>
      | Array<IRabbitSubscription<IHermesMessage>>,
  ): Promise<void>;
}
