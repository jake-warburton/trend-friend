import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { dynamic as exploreDynamic } from "@/app/explore/page";
import { config as middlewareConfig } from "@/middleware";

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("explore route stays force-static", () => {
  assert.equal(exploreDynamic, "force-static");
});

test("middleware matcher remains narrowly scoped", () => {
  assert.deepEqual(middlewareConfig.matcher, [
    "/admin/:path*",
    "/login",
    "/signup",
  ]);
});

test("public shell files do not import cookies or headers", () => {
  const rootLayout = readProjectFile("app/layout.tsx");
  const landingPage = readProjectFile("app/page.tsx");
  const explorePage = readProjectFile("app/explore/page.tsx");

  for (const source of [rootLayout, landingPage, explorePage]) {
    assert.doesNotMatch(source, /\bfrom "next\/headers"/);
    assert.doesNotMatch(source, /\bcookies\(/);
    assert.doesNotMatch(source, /\bheaders\(/);
  }
});

test("browse pages use the lighter explorer payload instead of the detail index", () => {
  const categoriesPage = readProjectFile("app/categories/page.tsx");
  const categoryPage = readProjectFile("app/categories/[slug]/page.tsx");
  const metaTrendsPage = readProjectFile("app/meta-trends/page.tsx");
  const metaTrendPage = readProjectFile("app/meta-trends/[slug]/page.tsx");

  for (const source of [
    categoriesPage,
    categoryPage,
    metaTrendsPage,
    metaTrendPage,
  ]) {
    assert.match(source, /loadTrendExplorer/);
    assert.doesNotMatch(source, /loadTrendDetails/);
  }
});

test("compare page only loads detail records for selected trend ids", () => {
  const comparePage = readProjectFile("app/compare/page.tsx");

  assert.match(comparePage, /loadTrendDetailsByIds/);
  assert.doesNotMatch(comparePage, /loadTrendDetails\(/);
});

test("server refresh loop remains opt-in in instrumentation", () => {
  const instrumentation = readProjectFile("instrumentation.ts");

  assert.match(instrumentation, /isServerRefreshLoopEnabled/);
  assert.match(instrumentation, /!isServerRefreshLoopEnabled\(\)/);
});
