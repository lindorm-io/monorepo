/**
 * LINDORM EXTENSION. The order in which a subject's name parts are composed
 * for display. Not an OIDC concept — it backs the lindorm `namingSystem`
 * claim, which has no RFC counterpart.
 */
export const NamingSystem = {
  /** wire: `given_family` — western order, e.g. "Ada Lovelace" */
  GivenFamily: "given_family",
  /** wire: `family_given` — eastern order, e.g. "Lovelace Ada" */
  FamilyGiven: "family_given",
} as const;

export type NamingSystem = (typeof NamingSystem)[keyof typeof NamingSystem];
