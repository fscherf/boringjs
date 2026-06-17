export function hashString(string: string): string {
  // implements DJB2

  let hash = 5381;

  for (let index = 0; index < string.length; index++) {
    hash = (hash * 33) ^ string.charCodeAt(index);
  }

  return `h_${hash >>> 0}`;
}

export function resolveUrl(baseUrl: string, relativeUrl: string): string {
  // relative URL is already absolute
  if (/^(https?:)?\/\//.test(relativeUrl)) {
    return relativeUrl;
  }

  // ignore special schemes
  if (/^(data:|blob:|mailto:|tel:)/.test(relativeUrl)) {
    return relativeUrl;
  }

  return new URL(relativeUrl, baseUrl).toString();
}
