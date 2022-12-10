import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Storage, useStorage } from "./use-storage";

type UseStorage<S> = [S, Dispatch<SetStateAction<S>>, Dispatch<SetStateAction<boolean>>];

type Options = {
  disabled: boolean;
  namespace: string;
  storage: Storage;
};

export const useStoredState = <S>(
  key: string,
  initialState?: S,
  options: Partial<Options> = {},
): UseStorage<S> => {
  const { disabled: initialDisable = false, namespace, storage = "local" } = options;
  const storageKey = namespace ? `${namespace}:${key}` : key;

  const { getItem, setItem, removeItem } = useStorage(storage);
  const [disabled, setDisabled] = useState<boolean>(initialDisable);
  const [state, setState] = useState<S>(getItem<S>(storageKey) || (initialState as S));

  useEffect(() => {
    if (disabled) {
      return removeItem(storageKey);
    }
    setItem<S>(storageKey, state);
  }, [disabled, state, storageKey, removeItem, setItem]);

  return [state, setState, setDisabled];
};
