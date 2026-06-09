import { LindormError } from "@lindorm/errors";
import { Predicated } from "@lindorm/utils";
import type { Dict, Predicate } from "@lindorm/types";

export const validate = <C extends Dict = Dict>(
  dict: C,
  predicate: Predicate<C>,
): void => {
  if (Predicated.match(dict, predicate)) return;

  const invalid: Array<{ key: string; value: any }> = [];
  for (const [key, ops] of Object.entries(predicate)) {
    if (!Predicated.match({ [key]: dict[key] }, { [key]: ops } as any)) {
      invalid.push({ key, value: dict[key] });
    }
  }

  throw new LindormError("Invalid token", {
    code: "jwt_claims_invalid",
    type: "urn:lindorm:aegis:error:jwt_claims_invalid",
    data: { invalid: invalid.map(({ key }) => key) },
    debug: { invalid },
    title: "JWT Claims Invalid",
    details:
      "One or more claims did not satisfy the supplied validation predicate; see the invalid list for the failing claim keys.",
  });
};
