export type FetchOptions = {
  baseUrl: string;
  /** The API token, sent as a bearer token. */
  token: string;
  fetchImpl?: typeof fetch;
};

/** One page of `path` from the order-history API. */
export async function fetchPage(path: string, page: number, o: FetchOptions): Promise<unknown> {
  const url = new URL(path, o.baseUrl);
  url.searchParams.set("page", String(page));
  const headers = { authorization: `Bearer ${o.token}`, accept: "application/json" };
  const res = await (o.fetchImpl ?? fetch)(url, { headers });
  if (!res.ok) throw new Error(`GET ${url.pathname} page ${page}: HTTP ${res.status}`);
  return res.json();
}
