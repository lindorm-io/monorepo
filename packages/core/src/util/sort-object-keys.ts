export const sortObjectKeys = <
  Input extends Record<string, any>,
  Output extends Record<string, any>,
>(
  input: Input,
): Output => {
  const result: Record<string, any> = {};

  for (const key of Object.keys(input).sort()) {
    result[key] = input[key];
  }

  return result as Output;
};
