import { createContext, useContext, useMemo, type FC, type ReactNode } from "react";
import type { IZephyr } from "../interfaces/Zephyr";
import type { ZephyrEventMap } from "../types/event-map";

type ZephyrContextValue<E extends ZephyrEventMap = ZephyrEventMap> = {
  client: IZephyr<E>;
};

const ZephyrContext = createContext<ZephyrContextValue | null>(null);

export type ZephyrProviderProps<E extends ZephyrEventMap = ZephyrEventMap> = {
  client: IZephyr<E>;
  children: ReactNode;
};

export const ZephyrProvider: FC<ZephyrProviderProps> = ({ client, children }) => {
  const value = useMemo<ZephyrContextValue>(() => ({ client }), [client]);

  return <ZephyrContext.Provider value={value}>{children}</ZephyrContext.Provider>;
};

export const useZephyrContext = (): ZephyrContextValue => {
  const ctx = useContext(ZephyrContext);

  if (!ctx) {
    throw new Error("useZephyr must be used within a ZephyrProvider");
  }

  return ctx;
};
