import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useDeferredValue,
} from "react";
import { DEFAULT_SORT_DIRECTIONS, EXPLORER_PAGE_SIZE } from "./constants";
import { THESIS_PRESETS } from "./thesis-presets";
import {
  listActiveExplorerFilters,
  isThesisPresetApplied,
  shouldClearActiveThesisPreset,
} from "./filters";
import type { ThesisPreset } from "./types";

export function useExplorerFilters() {
  // -- Explorer filter state (defaults match SSR; hydrated from URL in effect below) --
  const [keyword, setKeyword] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedConfidence, setSelectedConfidence] = useState<string>("all");
  const [selectedLens, setSelectedLens] = useState<string>("all");
  const [selectedMetaTrend, setSelectedMetaTrend] = useState<string>("all");
  const [selectedAudience, setSelectedAudience] = useState<string>("all");
  const [selectedMarket, setSelectedMarket] = useState<string>("all");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [selectedGeoCountry, setSelectedGeoCountry] = useState<string>("all");
  const [minimumScore, setMinimumScore] = useState<number | null>(0);
  const [sortBy, setSortBy] = useState<string>("rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [hideRecurring, setHideRecurring] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const deferredKeyword = useDeferredValue(keyword);

  // -- Hydrate explorer filter state from URL params on mount --
  const urlHydratedRef = useRef(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const hasParams = p.toString().length > 0;
    if (!hasParams) { urlHydratedRef.current = true; return; }
    if (p.get("q")) setKeyword(p.get("q")!);
    if (p.get("source")) setSelectedSource(p.get("source")!);
    if (p.get("category")) setSelectedCategory(p.get("category")!);
    if (p.get("stage")) setSelectedStage(p.get("stage")!);
    if (p.get("confidence")) setSelectedConfidence(p.get("confidence")!);
    if (p.get("lens")) setSelectedLens(p.get("lens")!);
    if (p.get("metaTrend")) setSelectedMetaTrend(p.get("metaTrend")!);
    if (p.get("audience")) setSelectedAudience(p.get("audience")!);
    if (p.get("market")) setSelectedMarket(p.get("market")!);
    if (p.get("language")) setSelectedLanguage(p.get("language")!);
    if (p.get("geo")) setSelectedGeoCountry(p.get("geo")!);
    if (p.get("minScore")) setMinimumScore(Number(p.get("minScore")));
    if (p.get("sort")) setSortBy(p.get("sort")!);
    if (p.get("dir") === "desc") setSortDirection("desc");
    if (p.get("status")) setSelectedStatus(p.get("status")!);
    if (p.get("hideRecurring") === "1") setHideRecurring(true);
    if (p.get("page")) setCurrentPage(Math.max(1, Number(p.get("page"))));
    // Mark hydrated after a tick so the filter-reset and URL-sync effects skip
    // the state changes triggered by this hydration.
    requestAnimationFrame(() => { urlHydratedRef.current = true; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset page to 1 when any filter changes (but not during hydration or mount).
  const filterFingerprint = `${keyword}|${selectedSource}|${selectedCategory}|${selectedStage}|${selectedConfidence}|${selectedLens}|${selectedMetaTrend}|${selectedAudience}|${selectedMarket}|${selectedLanguage}|${selectedGeoCountry}|${minimumScore}|${sortBy}|${sortDirection}|${selectedStatus}|${hideRecurring}`;
  const prevFilterFingerprint = useRef(filterFingerprint);
  useEffect(() => {
    if (!urlHydratedRef.current) { prevFilterFingerprint.current = filterFingerprint; return; }
    if (prevFilterFingerprint.current !== filterFingerprint) {
      prevFilterFingerprint.current = filterFingerprint;
      setCurrentPage(1);
    }
  }, [filterFingerprint]);

  // -- Sync explorer filter state → URL (replaceState to avoid history spam) --
  useEffect(() => {
    if (!urlHydratedRef.current) return;
    const params = new URLSearchParams();
    if (keyword) params.set("q", keyword);
    if (selectedSource !== "all") params.set("source", selectedSource);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedStage !== "all") params.set("stage", selectedStage);
    if (selectedConfidence !== "all") params.set("confidence", selectedConfidence);
    if (selectedLens !== "all") params.set("lens", selectedLens);
    if (selectedMetaTrend !== "all") params.set("metaTrend", selectedMetaTrend);
    if (selectedAudience !== "all") params.set("audience", selectedAudience);
    if (selectedMarket !== "all") params.set("market", selectedMarket);
    if (selectedLanguage !== "all") params.set("language", selectedLanguage);
    if (selectedGeoCountry !== "all") params.set("geo", selectedGeoCountry);
    if (minimumScore && minimumScore > 0) params.set("minScore", String(minimumScore));
    if (sortBy !== "rank") params.set("sort", sortBy);
    if (sortDirection !== "asc") params.set("dir", sortDirection);
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    if (hideRecurring) params.set("hideRecurring", "1");
    if (currentPage > 1) params.set("page", String(currentPage));
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", url);
  }, [
    keyword, selectedSource, selectedCategory, selectedStage, selectedConfidence,
    selectedLens, selectedMetaTrend, selectedAudience, selectedMarket,
    selectedLanguage, selectedGeoCountry, minimumScore, sortBy, sortDirection,
    selectedStatus, hideRecurring, currentPage,
  ]);

  const activeExplorerFilters = useMemo(
    () =>
      listActiveExplorerFilters({
        keyword,
        selectedSource,
        selectedCategory,
        selectedStage,
        selectedConfidence,
        selectedLens,
        selectedMetaTrend,
        selectedAudience,
        selectedMarket,
        selectedLanguage,
        selectedGeoCountry,
        sortBy,
        sortDirection,
        selectedStatus,
        hideRecurring,
      }),
    [
      hideRecurring,
      keyword,
      selectedAudience,
      selectedCategory,
      selectedConfidence,
      selectedGeoCountry,
      selectedLens,
      selectedLanguage,
      selectedMarket,
      selectedMetaTrend,
      selectedSource,
      selectedStage,
      selectedStatus,
      sortBy,
      sortDirection,
    ],
  );

  const activeThesisPresetKey = useMemo(
    () =>
      THESIS_PRESETS.find((preset) =>
        isThesisPresetApplied(preset, {
          keyword,
          selectedSource,
          selectedCategory,
          selectedStage,
          selectedConfidence,
          selectedLens,
          selectedMetaTrend,
          selectedAudience,
          selectedMarket,
          selectedLanguage,
          selectedGeoCountry,
          minimumScore,
          sortBy,
          sortDirection,
          selectedStatus,
          hideRecurring,
        }),
      )?.key ?? null,
    [
      hideRecurring,
      keyword,
      minimumScore,
      selectedAudience,
      selectedCategory,
      selectedConfidence,
      selectedGeoCountry,
      selectedLanguage,
      selectedLens,
      selectedMarket,
      selectedMetaTrend,
      selectedSource,
      selectedStage,
      selectedStatus,
      sortBy,
      sortDirection,
    ],
  );

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSource !== "all") params.set("source", selectedSource);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedStage !== "all") params.set("stage", selectedStage);
    if (selectedConfidence !== "all")
      params.set("confidence", selectedConfidence);
    if (selectedLens !== "all") params.set("lens", selectedLens);
    if (selectedMetaTrend !== "all") params.set("metaTrend", selectedMetaTrend);
    if (selectedAudience !== "all") params.set("audience", selectedAudience);
    if (selectedMarket !== "all") params.set("market", selectedMarket);
    if (selectedLanguage !== "all") params.set("language", selectedLanguage);
    if (selectedGeoCountry !== "all") params.set("geo", selectedGeoCountry);
    if (keyword) params.set("q", keyword);
    if (minimumScore && minimumScore > 0)
      params.set("min", String(minimumScore));
    if (hideRecurring) params.set("hideRecurring", "1");
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    params.set("sort", sortBy);
    params.set("sortDir", sortDirection);
    return `/api/export?${params.toString()}`;
  }, [
    selectedSource,
    selectedCategory,
    selectedStage,
    selectedConfidence,
    selectedLens,
    selectedMetaTrend,
    selectedAudience,
    selectedMarket,
    selectedLanguage,
    selectedGeoCountry,
    keyword,
    minimumScore,
    hideRecurring,
    selectedStatus,
    sortBy,
    sortDirection,
  ]);

  function handleSortChange(value: string) {
    setSortBy(value);
    setSortDirection(DEFAULT_SORT_DIRECTIONS[value] ?? "desc");
  }

  function clearExplorerFilter(filterKey: string) {
    if (filterKey === "keyword") {
      setKeyword("");
      return;
    }
    if (filterKey === "source") {
      setSelectedSource("all");
      return;
    }
    if (filterKey === "category") {
      setSelectedCategory("all");
      return;
    }
    if (filterKey === "stage") {
      setSelectedStage("all");
      return;
    }
    if (filterKey === "confidence") {
      setSelectedConfidence("all");
      return;
    }
    if (filterKey === "lens") {
      setSelectedLens("all");
      return;
    }
    if (filterKey === "metaTrend") {
      setSelectedMetaTrend("all");
      return;
    }
    if (filterKey === "audience") {
      setSelectedAudience("all");
      return;
    }
    if (filterKey === "market") {
      setSelectedMarket("all");
      return;
    }
    if (filterKey === "language") {
      setSelectedLanguage("all");
      return;
    }
    if (filterKey === "geo") {
      setSelectedGeoCountry("all");
      return;
    }
    if (filterKey === "sort") {
      setSortBy("rank");
      setSortDirection("asc");
      return;
    }
    if (filterKey === "status") {
      setSelectedStatus("all");
      return;
    }
    setHideRecurring(false);
  }

  function clearAllExplorerFilters() {
    setKeyword("");
    setSelectedSource("all");
    setSelectedCategory("all");
    setSelectedStage("all");
    setSelectedConfidence("all");
    setSelectedLens("all");
    setSelectedMetaTrend("all");
    setSelectedAudience("all");
    setSelectedMarket("all");
    setSelectedLanguage("all");
    setSelectedGeoCountry("all");
    setSortBy("rank");
    setSortDirection("asc");
    setSelectedStatus("all");
    setMinimumScore(0);
    setHideRecurring(false);
    setCurrentPage(1);
  }

  function applyThesisPreset(preset: ThesisPreset) {
    if (shouldClearActiveThesisPreset(activeThesisPresetKey, preset)) {
      clearAllExplorerFilters();
      return;
    }
    setKeyword("");
    setSelectedSource(preset.source ?? "all");
    setSelectedCategory("all");
    setSelectedStage(preset.stage ?? "all");
    setSelectedConfidence("all");
    setSelectedLens(preset.lens ?? "all");
    setSelectedMetaTrend("all");
    setSelectedAudience(preset.audience ?? "all");
    setSelectedMarket("all");
    setSelectedLanguage("all");
    setSelectedGeoCountry("all");
    const presetSort = preset.sortBy ?? "rank";
    setSortBy(presetSort);
    setSortDirection(
      preset.sortDirection ?? DEFAULT_SORT_DIRECTIONS[presetSort] ?? "asc",
    );
    setSelectedStatus(preset.status ?? "all");
    setMinimumScore(preset.minimumScore ?? 0);
    setHideRecurring(preset.hideRecurring ?? false);
    setCurrentPage(1);
  }

  return {
    // Filter states
    keyword,
    selectedSource,
    selectedCategory,
    selectedStage,
    selectedConfidence,
    selectedLens,
    selectedMetaTrend,
    selectedAudience,
    selectedMarket,
    selectedLanguage,
    selectedGeoCountry,
    minimumScore,
    sortBy,
    sortDirection,
    selectedStatus,
    hideRecurring,
    currentPage,
    deferredKeyword,

    // Filter setters
    setKeyword,
    setSelectedSource,
    setSelectedCategory,
    setSelectedStage,
    setSelectedConfidence,
    setSelectedLens,
    setSelectedMetaTrend,
    setSelectedAudience,
    setSelectedMarket,
    setSelectedLanguage,
    setSelectedGeoCountry,
    setMinimumScore,
    setSortBy,
    setSortDirection,
    setSelectedStatus,
    setHideRecurring,
    setCurrentPage,

    // Derived values
    activeExplorerFilters,
    activeThesisPresetKey,
    exportHref,

    // Handler functions
    handleSortChange,
    clearExplorerFilter,
    clearAllExplorerFilters,
    applyThesisPreset,
  };
}
