import type { PylonEventMap } from "./pylon-event-map.js";

export type PylonSocketEmitter<E extends PylonEventMap = PylonEventMap> = {
  emit: <K extends string & keyof E>(target: string, event: K, data?: E[K]) => void;
};

export type PylonSocketEmitterWithBroadcast<E extends PylonEventMap = PylonEventMap> = {
  emit: <K extends string & keyof E>(target: string, event: K, data?: E[K]) => void;
  broadcast: <K extends string & keyof E>(target: string, event: K, data?: E[K]) => void;
};
