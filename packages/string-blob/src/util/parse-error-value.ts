import { isObject } from "@lindorm-io/core";

export const parseErrorValue = (input: any): Error => {
  const parsed = isObject(input) ? input : JSON.parse(input);

  const error: any = new Error(parsed.message);
  error.stack = parsed.stack;

  for (const [key, value] of Object.entries(parsed)) {
    if (key === "message" || key === "stack") continue;
    error[key] = value;
  }

  return error;
};
