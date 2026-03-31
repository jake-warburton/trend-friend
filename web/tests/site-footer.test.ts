import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SiteFooter } from "@/components/site-footer";

test("site footer links to the intelligence pages", () => {
  const html = renderToStaticMarkup(createElement(SiteFooter));

  assert.match(html, /href="\/ai-use-cases"/);
  assert.match(html, /href="\/social-intelligence"/);
  assert.match(html, /href="\/ad-intelligence"/);
});
