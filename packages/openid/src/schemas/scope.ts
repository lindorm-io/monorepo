import { z } from "zod";
import { LindormScope, Scope, StandardScope } from "../enums/Scope.js";

/**
 * CLOSED validator for the LINDORM EXTENSION scopes only, built from the
 * `LindormScope` runtime object. Use it where a value must be one of ours and
 * a standard scope would be wrong.
 */
export const lindormScopeSchema = z.enum(LindormScope);

/**
 * CLOSED validator for the RFC-standard scopes only — OIDC Core §5.4 plus
 * §11 (`offline_access`) — built from the `StandardScope` runtime object. Use
 * it where a lindorm extension must not be accepted.
 */
export const standardScopeSchema = z.enum(StandardScope);

/**
 * CLOSED validator for every scope value this vocabulary knows — the lindorm
 * extensions plus the RFC-standard set — built from the composed `Scope`
 * runtime object.
 *
 * RFC 6749 §3.3 lets a deployment define its own scope values; one that does
 * validates them with its own union rather than loosening this schema.
 */
export const scopeSchema = z.enum(Scope);
