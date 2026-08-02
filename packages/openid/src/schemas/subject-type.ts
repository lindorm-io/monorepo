import { z } from "zod";
import { SubjectType } from "../enums/SubjectType.js";

/**
 * CLOSED validator for the OIDC Core §8 subject identifier types, built from
 * the `SubjectType` runtime object.
 */
export const subjectTypeSchema = z.enum(SubjectType);
