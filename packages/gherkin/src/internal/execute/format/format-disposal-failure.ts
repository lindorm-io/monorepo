import { joinBlocks } from "./join-blocks.js";

export type DisposalFailureFormat = {
  /** The `@Context` class whose `dispose()` threw or rejected. */
  className: string;
  /** The original error's message — preserved verbatim, never re-worded. */
  message: string;
};

export const formatDisposalFailure = ({
  className,
  message,
}: DisposalFailureFormat): string =>
  joinBlocks([`Context class ${className} dispose() threw`, message]);
