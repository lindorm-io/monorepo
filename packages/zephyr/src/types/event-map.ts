import { Dict } from "@lindorm/types";

export type ZephyrEventDefinition = {
  outgoing?: any;
  incoming?: any;
};

export type ZephyrEventMap = Dict<ZephyrEventDefinition>;

export type EventOutgoing<E extends ZephyrEventMap, K extends keyof E> = E[K] extends {
  outgoing: infer O;
}
  ? O
  : any;

export type EventIncoming<E extends ZephyrEventMap, K extends keyof E> = E[K] extends {
  incoming: infer I;
}
  ? I
  : any;
