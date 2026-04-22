import type { IMessage } from "../interfaces/index.js";
import type { IrisHookMeta } from "./iris-hook-meta.js";

export type HookCallback<M extends IMessage = IMessage> = (
  message: M,
  meta: IrisHookMeta,
) => void | Promise<void>;

export type ErrorHookCallback<M extends IMessage = IMessage> = (
  error: Error,
  message: M,
  meta: IrisHookMeta,
) => void | Promise<void>;
