export const guardEmptyCriteria = (
  criteria: Record<string, unknown>,
  operation: string,
  ErrorClass: new (
    message: string,
    options?: { code?: string; data?: Record<string, unknown> },
  ) => Error,
): void => {
  if (Object.keys(criteria).length === 0) {
    throw new ErrorClass(`${operation} requires non-empty criteria`, {
      code: "empty_criteria",
      data: { operation },
    });
  }
};
