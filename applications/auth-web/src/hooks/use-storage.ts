export type StorageType = "localStorage" | "sessionStorage";

type UseStorage = {
  getItem: <T = unknown>(key: string, defaultValue?: T) => T | undefined;
  removeItem: (key: string) => void;
  setItem: <T = unknown>(key: string, value: T) => void;
};

const isBrowser = (): boolean => typeof window !== "undefined";

export const useStorage = (storage: StorageType = "localStorage"): UseStorage => {
  const browser = isBrowser();

  const getItem = <T = any>(key: string): T | undefined => {
    if (!browser) return;
    const value = window[storage][key];
    return value ? JSON.parse(value) : undefined;
  };

  const removeItem = (key: string): void => {
    if (!browser) return;
    window[storage].removeItem(key);
  };

  const setItem = <T = any>(key: string, value: T): void => {
    if (!browser) return;
    window[storage].setItem(key, JSON.stringify(value));
  };

  return {
    getItem,
    removeItem,
    setItem,
  };
};
