import { useEffect, useMemo } from "react";
import type { IZephyrRoom } from "../interfaces/ZephyrRoom.js";
import { useZephyrContext } from "./ZephyrProvider.js";

export const useRoom = (name: string): IZephyrRoom => {
  const { client } = useZephyrContext();

  const room = useMemo(() => client.room(name), [client, name]);

  useEffect(() => {
    void room.join();

    return (): void => {
      void room.leave();
    };
  }, [room]);

  return room;
};
