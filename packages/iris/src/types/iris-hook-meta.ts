/**
 * Minimal, framework-agnostic metadata threaded through the Iris hook pipeline.
 * Replaces the legacy user-defined context generic so the messaging layer stays
 * decoupled from framework context shapes (e.g. Koa's ctx).
 */
export type IrisHookMeta = {
  correlationId: string;
  actor: string | null;
  timestamp: Date;
};

/**
 * The default meta used when no caller-supplied context is threaded into a
 * source or session. Intentionally stateless — callers that need a real
 * correlation id should always pass an explicit context when constructing the
 * session (e.g. from a request-scoped middleware).
 */
export const createDefaultIrisHookMeta = (): IrisHookMeta => ({
  correlationId: "unknown",
  actor: null,
  timestamp: new Date(),
});
