import type { IMessage } from "../interfaces/index.js";

export type HookCallback<M extends IMessage = IMessage, C = unknown> = (
  message: M,
  context?: C,
) => void | Promise<void>;

export type ErrorHookCallback<M extends IMessage = IMessage, C = unknown> = (
  error: Error,
  message: M,
  context?: C,
) => void | Promise<void>;
