// web/tests/json-ld.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArticleJsonLd,
  buildCollectionPageJsonLd,
  buildBreadcrumbJsonLd,
} from "@/components/json-ld";

test("buildArticleJsonLd produces valid Article schema", () => {
  const result = buildArticleJsonLd({
    headline: "AI Agents — Trend Analysis",
    description: "AI Agents is trending across 8 sources",
    url: "https://www.signaleye.live/trends/ai-agents",
    imageUrl: "https://upload.wikimedia.org/image.jpg",
  });
  assert.equal(result["@context"], "https://schema.org");
  assert.equal(result["@type"], "Article");
  assert.equal(result.headline, "AI Agents — Trend Analysis");
  assert.equal(result.author["@type"], "Organization");
  assert.equal(result.author.name, "Signal Eye");
  assert.ok(result.dateModified);
  assert.deepEqual(result.image, ["https://upload.wikimedia.org/image.jpg"]);
});

test("buildArticleJsonLd omits image when not provided", () => {
  const result = buildArticleJsonLd({
    headline: "Test",
    description: "Test desc",
    url: "https://www.signaleye.live/trends/test",
  });
  assert.equal(result.image, undefined);
});

test("buildCollectionPageJsonLd produces valid CollectionPage schema", () => {
  const result = buildCollectionPageJsonLd({
    name: "Artificial Intelligence Trends",
    description: "47 emerging AI trends",
    url: "https://www.signaleye.live/categories/artificial-intelligence",
    numberOfItems: 47,
  });
  assert.equal(result["@context"], "https://schema.org");
  assert.equal(result["@type"], "CollectionPage");
  assert.equal(result.numberOfItems, 47);
});

test("buildBreadcrumbJsonLd produces valid BreadcrumbList", () => {
  const result = buildBreadcrumbJsonLd([
    { name: "Home", url: "https://www.signaleye.live" },
    { name: "Categories", url: "https://www.signaleye.live/categories" },
    { name: "AI", url: "https://www.signaleye.live/categories/ai" },
  ]);
  assert.equal(result["@type"], "BreadcrumbList");
  assert.equal(result.itemListElement.length, 3);
  assert.equal(result.itemListElement[0].position, 1);
  assert.equal(result.itemListElement[2].item, "https://www.signaleye.live/categories/ai");
});
