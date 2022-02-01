export const axiosTestRequests: Array<any> = [];
export const axiosTestResponse: Record<string, any> = {};

export const getAxiosResponse = (method: string, name: string, path: string, args: any): any => {
  axiosTestRequests.push({ method, name, path, args });
  return { data: axiosTestResponse[`${method.toUpperCase()}::${name}::${path}`] };
};

export const setAxiosResponse = (method: string, name: string, path: string, data: any): void => {
  axiosTestResponse[`${method.toUpperCase()}::${name}::${path}`] = data;
};
