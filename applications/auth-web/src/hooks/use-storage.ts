export type Storage = "local" | "session";
type StorageType = "localStorage" | "sessionStorage";

type UseStorageHook = {
  getItem: <T = unknown>(key: string, defaultValue?: T) => T | undefined;
  removeItem: (key: string) => void;
  setItem: <T = unknown>(key: string, value: T) => void;
};

const isBrowser = (): boolean => typeof window !== "undefined";

const getStorageType = (type?: Storage): StorageType =>
  type === "session" ? "sessionStorage" : "localStorage";

export const useStorage = (storage: Storage = "local"): UseStorageHook => {
  const getItem = <T = any>(key: string): T | undefined => {
    const value = isBrowser() ? window[getStorageType(storage)][key] : undefined;
    return value ? JSON.parse(value) : undefined;
  };

  const removeItem = (key: string): void =>
    isBrowser() ? window[getStorageType(storage)].removeItem(key) : undefined;

  const setItem = <T = any>(key: string, value: T): void =>
    isBrowser() ? window[getStorageType(storage)].setItem(key, JSON.stringify(value)) : undefined;

  return {
    getItem,
    removeItem,
    setItem,
  };
};
