export const sanitiseToken = (token: string): string => {
  if (!token || !token.includes(".")) return token;

  const split = token.split(".");

  switch (split.length) {
    case 3:
      // jwt should only return header and payload.
      return `${split[0]}.${split[1]}`;

    case 5:
      // jwe should only return header. it's the only thing that can be decoded.
      return split[0];

    default:
      return token;
  }
};
