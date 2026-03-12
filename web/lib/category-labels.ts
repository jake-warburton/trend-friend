const UPPERCASE_CATEGORY_TOKENS = new Set(["ai", "api", "ml", "llm", "vr", "ar", "ev", "b2b", "b2c"]);

export function formatCategoryLabel(category: string): string {
  return category
    .split("-")
    .map((part) => {
      if (UPPERCASE_CATEGORY_TOKENS.has(part.toLowerCase())) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}
