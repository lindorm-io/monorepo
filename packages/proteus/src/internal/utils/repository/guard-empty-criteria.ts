export const guardEmptyCriteria = (
  criteria: Record<string, unknown>,
  operation: string,
  ErrorClass: new (message: string) => Error,
): void => {
  if (Object.keys(criteria).length === 0) {
    throw new ErrorClass(`${operation} requires non-empty criteria`);
  }
};
