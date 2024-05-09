import { Middleware } from "../types";
import { composeMiddleware } from "./compose-middleware";

type Options = {
  useClone?: boolean;
};

export const resolveMiddleware = async <Context>(
  context: Context,
  middleware: Array<Middleware<Context>>,
  options: Options = {},
): Promise<Context> => {
  const { useClone = true } = options;

  const ctx = useClone ? structuredClone(context) : context;

  await composeMiddleware<Context>(middleware)(ctx);

  return ctx;
};
