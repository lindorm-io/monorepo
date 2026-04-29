/**
 * Minimal, framework-agnostic metadata threaded through the Proteus hook and
 * entity-event pipelines. Replaces the legacy user-defined `C` generic so the
 * ORM stays decoupled from framework context shapes (e.g. Koa's ctx).
 */
export type ProteusHookMeta = {
  correlationId: string;
  actor: string;
  timestamp: Date;
};

/**
 * The default meta used when no caller-supplied context is threaded into a
 * source or session. Intentionally stateless — callers that need a real
 * correlation id should always pass an explicit context when constructing the
 * session (e.g. from a request-scoped middleware).
 */
export const createDefaultProteusHookMeta = (): ProteusHookMeta => ({
  correlationId: "unknown",
  actor: "unknown",
  timestamp: new Date(),
});
