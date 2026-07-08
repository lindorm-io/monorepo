/**
 * Canned rows for a seeded mock proteus, keyed by entity class name
 * (`Entity.name`). A session/source built with this serves each entity's rows
 * through its repository's read queries (find / findOne / findPaginated / …).
 */
export type MockProteusRows = Record<string, Array<any>>;
