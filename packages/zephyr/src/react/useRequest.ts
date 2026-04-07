import { useCallback, useEffect, useRef, useState } from "react";
import type { ZephyrError } from "../errors/ZephyrError";
import { useZephyrContext } from "./ZephyrProvider";

type UseRequestOptions = {
  timeout?: number;
  enabled?: boolean;
};

type UseRequestResult<T> = {
  data: T | undefined;
  error: ZephyrError | undefined;
  loading: boolean;
  refetch: () => Promise<void>;
};

export const useRequest = <T = any>(
  event: string,
  data?: any,
  options?: UseRequestOptions,
): UseRequestResult<T> => {
  const { client } = useZephyrContext();
  const enabled = options?.enabled ?? true;
  const timeout = options?.timeout;

  const [result, setResult] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ZephyrError | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);

  const dataRef = useRef(data);
  const serialisedData = JSON.stringify(data);

  useEffect(() => {
    dataRef.current = data;
  }, [serialisedData]);

  const fetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);

    try {
      const response = await client.request<any>(event, dataRef.current, {
        timeout,
      });
      setResult(response as T);
    } catch (err) {
      setError(err as ZephyrError);
    } finally {
      setLoading(false);
    }
  }, [client, event, timeout]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void fetch();
  }, [fetch, enabled, serialisedData]);

  return { data: result, error, loading, refetch: fetch };
};
