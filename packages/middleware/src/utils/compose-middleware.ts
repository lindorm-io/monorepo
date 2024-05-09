import { Middleware } from "../types";
import { _createDispatcher } from "./private/create-dispatcher";

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

  await _createDispatcher<Context>(middleware)(ctx);

  return ctx;
};
