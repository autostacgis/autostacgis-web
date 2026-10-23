import type { Json } from "./types";
export function apiUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use an HTTP(S) API root without embedded credentials, query or fragment",
    );
  return url.href.replace(/\/$/, "") + "/";
}
export class Api {
  readonly root: string;
  constructor(
    root: string,
    private token = "",
  ) {
    this.root = apiUrl(root);
  }
  async request(path: string, method = "GET", body?: Json) {
    const url = new URL(path, this.root);
    if (url.origin !== new URL(this.root).origin)
      throw new Error("Pagination must remain on the connected API origin");
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/geo+json, application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw new Error(`${response.status}: ${await response.text()}`);
    return response.status === 204 ? {} : response.json();
  }
  async search(body: Json) {
    return this.request("search", "POST", body);
  }
}
export function nextPage(page: Json, base: string, previous: Json) {
  const link = page.links?.find((link: Json) => link.rel === "next");
  if (!link) return null;
  const url = new URL(link.href, base);
  if (url.origin !== new URL(base).origin)
    throw new Error("Cross-origin pagination was refused");
  if (!["GET", "POST"].includes((link.method || "GET").toUpperCase()))
    throw new Error("STAC pagination only supports GET and POST");
  return {
    url: url.href,
    method: link.method || "GET",
    body: link.merge ? { ...previous, ...link.body } : link.body,
  };
}
export function resolveItem(item: Json, base: string) {
  return {
    ...item,
    assets: Object.fromEntries(
      Object.entries(item.assets || {}).map(([key, asset]: [string, any]) => [
        key,
        { ...asset, href: new URL(asset.href, base).href },
      ]),
    ),
  };
}

export function assetHref(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
