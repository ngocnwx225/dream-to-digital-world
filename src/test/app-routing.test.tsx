import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each([
    ["/login", "/login"],
    ["/dashboard", "/_app/dashboard"],
    ["/purchases", "/_app/purchases/"],
    ["/purchases/new", "/_app/purchases/new"],
    ["/purchases/abc", "/_app/purchases/$id"],
    ["/purchases/edit/abc", "/_app/purchases/edit/$id"],
    ["/sales", "/_app/sales/"],
    ["/sales/new", "/_app/sales/new"],
    ["/sales/abc", "/_app/sales/$id"],
    ["/sales/edit/abc", "/_app/sales/edit/$id"],
    ["/products", "/_app/products"],
    ["/inventory", "/_app/inventory"],
    ["/customers", "/_app/customers/"],
    ["/customers/abc", "/_app/customers/$id"],
    ["/reports", "/_app/reports"],
    ["/settings", "/_app/settings"],
  ])("routes %s to a real page", (path, routeId) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(routeId);
  });

  it("puts every business page behind the authenticated layout", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const path of ["/dashboard", "/sales", "/purchases", "/products", "/inventory", "/customers", "/reports", "/settings"]) {
      expect(router.matchRoutes(path).map((m) => m.routeId)).toContain("/_app");
    }
  });
});
