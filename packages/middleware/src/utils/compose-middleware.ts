import { Middleware } from "../types";
import { createDispatcher } from "./private";

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
