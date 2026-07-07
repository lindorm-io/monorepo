import { resolve } from "path";
import {
  handleUpload,
  type ResolvedUploadOptions,
} from "../../internal/utils/upload/handle-upload.js";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../types/index.js";

export type UseUploadOptions = {
  root: string;
  prefix?: string;
  naming?: "random" | "uuid" | "hash" | "original";
  extensions?: Array<string>;
  mimeTypes?: Array<string>;
  maxSize?: number;
  maxFiles?: number;
  overwrite?: boolean;
};

export const useUpload = <C extends PylonHttpContext = PylonHttpContext>(
  options: UseUploadOptions,
): PylonHttpMiddleware<C> => {
  const resolved: ResolvedUploadOptions = {
    root: resolve(process.cwd(), options.root),
    prefix: options.prefix ?? null,
    naming: options.naming ?? "random",
    extensions: options.extensions?.map((e) => e.toLowerCase()) ?? null,
    mimeTypes: options.mimeTypes ?? null,
    maxSize: options.maxSize ?? null,
    maxFiles: options.maxFiles ?? null,
    overwrite: options.overwrite ?? false,
  };

  return async function useUploadMiddleware(ctx, _next) {
    await handleUpload(ctx, resolved);
  };
};
