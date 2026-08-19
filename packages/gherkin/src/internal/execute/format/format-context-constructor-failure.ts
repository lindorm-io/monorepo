import { joinBlocks } from "./join-blocks.js";

export type ContextConstructorFailureFormat = {
  /** The TOKEN — the `@Context` class whose constructor threw. */
  className: string;
  /** The original error's message — preserved verbatim, never re-worded. */
  message: string;
};

/**
 * Anchored at the construction site inside the container: resolution is
 * recursive, so only the frame that called `new` knows WHICH token threw —
 * an outer wrap would blame the token that was first demanded.
 */
export const formatContextConstructorFailure = ({
  className,
  message,
}: ContextConstructorFailureFormat): string =>
  joinBlocks([`Context class ${className} constructor threw`, message]);
