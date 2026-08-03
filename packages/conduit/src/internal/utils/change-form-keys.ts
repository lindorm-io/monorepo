import { type ChangeCase, changeCase } from "@lindorm/case";

/**
 * `changeKeys` only walks plain objects/arrays, so a form-encoded request body
 * would otherwise go out with its keys untouched. Rebuilds the `FormData` with
 * every field name converted, preserving entry order, repeated keys and files.
 */
export const changeFormKeys = (form: FormData, mode: ChangeCase): FormData => {
  const result = new FormData();

  for (const [key, value] of form.entries()) {
    result.append(changeCase(key, mode), value);
  }

  return result;
};
