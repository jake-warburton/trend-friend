// web/components/json-ld.tsx

type ArticleJsonLdProps = {
  headline: string;
  description: string;
  url: string;
  imageUrl?: string;
};

type CollectionPageJsonLdProps = {
  name: string;
  description: string;
  url: string;
  numberOfItems: number;
};

type BreadcrumbItem = { name: string; url: string };

export function buildArticleJsonLd({ headline, description, url, imageUrl }: ArticleJsonLdProps) {
  return {
    "@context": "https://schema.org" as const,
    "@type": "Article" as const,
    headline,
    description,
    dateModified: new Date().toISOString(),
    author: { "@type": "Organization" as const, name: "Signal Eye" },
    mainEntityOfPage: url,
    ...(imageUrl ? { image: [imageUrl] } : {}),
  };
}

export function buildCollectionPageJsonLd({ name, description, url, numberOfItems }: CollectionPageJsonLdProps) {
  return {
    "@context": "https://schema.org" as const,
    "@type": "CollectionPage" as const,
    name,
    description,
    url,
    numberOfItems,
  };
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org" as const,
    "@type": "BreadcrumbList" as const,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const jsonLdArray = Array.isArray(data) ? data : [data];
  return (
    <>
      {jsonLdArray.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
