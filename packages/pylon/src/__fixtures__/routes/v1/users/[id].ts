export const getUser = async (_ctx: any, next: any) => {
  await next();
};
export const updateUser = async (_ctx: any, next: any) => {
  await next();
};
export const deleteUser = async (_ctx: any, next: any) => {
  await next();
};

export const GET = getUser;
export const PUT = updateUser;
export const DELETE = deleteUser;
