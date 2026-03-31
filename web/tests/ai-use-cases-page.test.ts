import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import AiUseCasesPage, { metadata } from "@/app/ai-use-cases/page";

test("ai use cases page advertises Pro access in metadata", () => {
  assert.match(String(metadata.description), /Pro/i);
});

test("ai use cases page renders a public teaser with an upgrade CTA", async () => {
  const html = renderToStaticMarkup(AiUseCasesPage());

  assert.match(html, /AI Use Cases/);
  assert.match(html, /Upgrade to Pro/);
  assert.match(html, /Pro feature/);
  assert.doesNotMatch(html, /Live AI use-case signals/);
});
