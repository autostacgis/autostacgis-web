import { afterEach, expect, it, vi } from "vitest";
import { Api, apiUrl, assetHref, nextPage, resolveItem } from "./api";
afterEach(() => vi.unstubAllGlobals());
it("keeps Bearer credentials on the connected origin and preserves merged POST pagination", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response('{"features":[]}', { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const api = new Api("https://catalog.test/v1", "secret");
  await api.search({ bbox: [0, 0, 1, 1] });
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer secret");
  await expect(api.request("https://evil.test/next")).rejects.toThrow("origin");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(
    nextPage(
      {
        links: [
          {
            rel: "next",
            href: "search",
            method: "POST",
            merge: true,
            body: { token: "next" },
          },
        ],
      },
      api.root + "search",
      { limit: 10 },
    ),
  ).toEqual({
    url: "https://catalog.test/v1/search",
    method: "POST",
    body: { limit: 10, token: "next" },
  });
  expect(() =>
    nextPage(
      { links: [{ rel: "next", href: "search", method: "DELETE" }] },
      api.root + "search",
      {},
    ),
  ).toThrow("GET and POST");
});
it("rejects unsafe roots and asset links and preserves signed URLs", () => {
  expect(() => apiUrl("https://user:secret@catalog.test")).toThrow();
  expect(assetHref("javascript:alert(1)")).toBeUndefined();
  const href = "https://assets.test/image.tif?signature=abc%2Fdef";
  expect(assetHref(href)).toBe(href);
  expect(
    resolveItem(
      { assets: { data: { href: "../image.tif?signature=abc%2Fdef" } } },
      "https://assets.test/v1/search",
    ).assets.data.href,
  ).toBe(href);
});
