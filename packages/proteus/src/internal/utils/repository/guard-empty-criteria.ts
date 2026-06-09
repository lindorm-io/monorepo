export const guardEmptyCriteria = (
  criteria: Record<string, unknown>,
  operation: string,
  ErrorClass: new (
    message: string,
    options?: {
      code?: string;
      title?: string;
      details?: string;
      data?: Record<string, unknown>;
    },
  ) => Error,
): void => {
  if (Object.keys(criteria).length === 0) {
    throw new ErrorClass(`${operation} requires non-empty criteria`, {
      code: "empty_criteria",
      title: "Empty Criteria",
      details:
        "Provide at least one criteria field so the operation does not affect every row.",
      data: { operation },
    });
  }
};
