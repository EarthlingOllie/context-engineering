import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchPage } from "../src/fetchPage.ts";

function fakeFetch(status: number, body: unknown, seen: Array<{ url: string; init: RequestInit | undefined }>): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

test("fetchPage asks for the page with the bearer token and returns the body", async () => {
  const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
  const body = await fetchPage("/v1/orders", 3, { baseUrl: "https://api.example.test", token: "t0k", fetchImpl: fakeFetch(200, { orders: [] }, seen) });
  assert.deepEqual(body, { orders: [] });
  assert.equal(seen[0]!.url, "https://api.example.test/v1/orders?page=3");
  assert.equal((seen[0]!.init!.headers as Record<string, string>)["authorization"], "Bearer t0k");
});

test("fetchPage throws on an HTTP error", async () => {
  await assert.rejects(fetchPage("/v1/orders", 1, { baseUrl: "https://api.example.test", token: "t", fetchImpl: fakeFetch(503, {}, []) }), /HTTP 503/);
});
