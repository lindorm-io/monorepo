type Storage = "local" | "session";
type StorageType = "localStorage" | "sessionStorage";

const isBrowser = (): boolean => typeof window !== "undefined";

const getStorageType = (type?: Storage): StorageType =>
  type === "session" ? "sessionStorage" : "localStorage";

type UseStorageHook = {
  setItem: <T = any>(key: string, value: T) => T;
  getItem: <T = any>(key: string, defaultValue?: T) => T;
  popItem: <T = any>(key: string) => T;
  removeItem: (key: string) => void;
};

export const useStorage = (storage: Storage = "local"): UseStorageHook => {
  const setItem = <T = any>(key: string, value: T): T => {
    isBrowser() ? window[getStorageType(storage)].setItem(key, JSON.stringify(value)) : undefined;

    return value;
  };

  const getItem = <T = any>(key: string, defaultValue?: T): T => {
    const value = isBrowser() ? window[getStorageType(storage)][key] : undefined;

    return value ? JSON.parse(value) : defaultValue;
  };

  const popItem = <T = any>(key: string): T => {
    const value = getItem(key);

    if (value) {
      removeItem(key);
    }

    return value;
  };

  const removeItem = (key: string): void =>
    isBrowser() ? window[getStorageType(storage)].removeItem(key) : undefined;

  return {
    setItem,
    getItem,
    popItem,
    removeItem,
  };
};
