import { useEffect, useRef } from "react";
import { useZephyrContext } from "./ZephyrProvider";

export const useEvent = (event: string, handler: (data: any) => void): void => {
  const { client } = useZephyrContext();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (data: any): void => {
      handlerRef.current(data);
    };

    client.on(event, listener);

    return (): void => {
      client.off(event, listener);
    };
  }, [client, event]);
};
