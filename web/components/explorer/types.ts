export type ThesisPreset = {
  key: string;
  label: string;
  description: string;
  lens?: string;
  source?: string;
  stage?: string;
  audience?: string;
  hideRecurring?: boolean;
  minimumScore?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  status?: string;
};

export type ExplorerActiveFilter = {
  key:
    | "keyword"
    | "source"
    | "category"
    | "stage"
    | "confidence"
    | "lens"
    | "metaTrend"
    | "audience"
    | "market"
    | "language"
    | "geo"
    | "sort"
    | "status"
    | "seasonality";
  label: string;
  value: string;
};

export type ThesisPresetFilterState = {
  keyword: string;
  selectedSource: string;
  selectedCategory: string;
  selectedStage: string;
  selectedConfidence: string;
  selectedLens: string;
  selectedMetaTrend: string;
  selectedAudience: string;
  selectedMarket: string;
  selectedLanguage: string;
  selectedGeoCountry: string;
  minimumScore: number | null;
  sortBy: string;
  sortDirection: "asc" | "desc";
  selectedStatus: string;
  hideRecurring: boolean;
};
