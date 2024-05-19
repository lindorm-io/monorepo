import { LindormError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { Operators } from "../../types";
import { _validateValue } from "./validate-value";

export const _validate = <C extends Dict = Dict>(
  dict: C,
  operators: Dict<Operators>,
): void => {
  const invalid: Array<{ key: string; value: any; ops: Operators }> = [];

  for (const [key, ops] of Object.entries(operators)) {
    const value = dict[key];

    if (_validateValue(value, ops)) continue;

    invalid.push({ key, value, ops });
  }

  if (invalid.length) {
    throw new LindormError("Invalid token", { data: { invalid } });
  }
};
