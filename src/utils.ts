export function hashString(string: string): string {
  // implements DJB2

  let hash = 5381;

  for (let index = 0; index < string.length; index++) {
    hash = (hash * 33) ^ string.charCodeAt(index);
  }

  return `h_${hash >>> 0}`;
}

export function resolveUrl({
  baseUrl,
  relativeUrl,
  templatingUrlPrefix,
}: {
  baseUrl: string;
  relativeUrl: string;
  templatingUrlPrefix: string;
}) {
  // Returns the resolved pathname of an URL, relative to a given base URL
  // or absolute to the given templating URL prefix, depending on whether the
  // relative URL starts with a slash.
  //
  // If the given relativeUrl already starts with `http(s)://`, it
  // remains untouched.
  //
  // Examples:
  //
  //   resolveUrl({
  //     baseUrl: "http://templates/foo/bar.html",
  //     templatingUrlPrefix: "/templates/",
  //     relativeUrl: "http://foo/main.css",
  //   }) -> "http://foo/main.css"  // untouched
  //
  //   resolveUrl({
  //     baseUrl: "http://templates/foo/bar.html",
  //     templatingUrlPrefix: "/templates/",
  //     relativeUrl: "./main.css",
  //   }) -> "/templates/foo/main.css"  // relative to /foo/bar.html
  //
  //   resolveUrl({
  //     baseUrl: "http://templates/foo/bar.html",
  //     templatingUrlPrefix: "/templates/",
  //     relativeUrl: "/main.css",
  //   }) -> "/templates/main.css"  // absolute to `templatingUrlPrefix`

  // relative URL is already absolute
  if (/^(https?:)?\/\//.test(relativeUrl)) {
    return relativeUrl;
  }

  // ignore special schemes
  if (/^(data:|blob:|mailto:|tel:)/.test(relativeUrl)) {
    return relativeUrl;
  }

  // relative URL is absolute to the templating URL prefix
  if (relativeUrl.startsWith("/")) {
    return new URL(
      relativeUrl.slice(1),
      `http://example.org${templatingUrlPrefix}`,
    ).pathname;
  }

  // relative URL is relative to base URL
  if (!/^(https?:)?\/\//.test(baseUrl)) {
    baseUrl = `http://example.org${baseUrl}`;
  }

  return new URL(relativeUrl, baseUrl).pathname;
}
