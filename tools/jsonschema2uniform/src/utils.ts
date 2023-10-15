export const nameToId = (str?: string): string => {
  if (!str) {
    return '';
  }

  const result = str
    .trim()
    .toLowerCase()
    .replace(/(?:(^.)|([-_\s]+.))/g, function (match: string) {
      return match.charAt(match.length - 1).toUpperCase();
    })
    .replace(/[^A-Za-z0-9-_]+/g, '');

  const camelized = result.charAt(0).toLowerCase() + result.substring(1);

  return camelized;
};
