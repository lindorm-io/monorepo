import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { StorageType, useStorage } from "./use-storage";

type UseStoredState<S> = [S, Dispatch<SetStateAction<S>>];

type Options = {
  namespace: string;
  storage: StorageType;
};

export const useStoredState = <S>(
  key: string,
  initialState?: S,
  options: Partial<Options> = {},
): UseStoredState<S> => {
  const { namespace, storage = "localStorage" } = options;
  const storageKey = namespace ? `${namespace}:${key}` : key;

  const { getItem, setItem, removeItem } = useStorage(storage);
  const [state, setState] = useState<S>(getItem<S>(storageKey) || (initialState as S));

  useEffect(() => {
    if (!state) {
      return removeItem(storageKey);
    }
    return setItem<S>(storageKey, state);
  }, [state, storageKey, removeItem, setItem]);

  return [state, setState];
};
