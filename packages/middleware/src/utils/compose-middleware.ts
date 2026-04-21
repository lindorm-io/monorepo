import type { Middleware } from "../types/index.js";
import { createDispatcher } from "../internal/index.js";

type Options = {
  useClone?: boolean;
};

export const composeMiddleware = async <Context>(
  context: Context,
  middleware: Array<Middleware<Context>>,
  options: Options = {},
): Promise<Context> => {
  const { useClone = true } = options;

  const ctx = useClone ? Object.assign({}, context) : context;

  await createDispatcher<Context>(middleware)(ctx);

  return ctx;
};
