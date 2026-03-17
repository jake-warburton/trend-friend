"use client";

import { Input } from "@base-ui/react/input";
import { NumberField } from "@base-ui/react/number-field";
import { Select } from "@base-ui/react/select";

import {
  SOURCE_FILTER_OPTIONS,
  STAGE_OPTIONS,
  CONFIDENCE_OPTIONS,
  LENS_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
} from "./constants";
import type { ExplorerActiveFilter } from "./types";
import { getOptionLabel } from "./format";

type ExplorerFiltersProps = {
  keyword: string;
  onKeywordChange: (value: string) => void;
  selectedSource: string;
  onSourceChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedStage: string;
  onStageChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  selectedConfidence: string;
  onConfidenceChange: (value: string) => void;
  selectedLens: string;
  onLensChange: (value: string) => void;
  selectedMetaTrend: string;
  onMetaTrendChange: (value: string) => void;
  selectedAudience: string;
  onAudienceChange: (value: string) => void;
  selectedMarket: string;
  onMarketChange: (value: string) => void;
  selectedLanguage: string;
  onLanguageChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  sortDirection: "asc" | "desc";
  onSortDirectionToggle: () => void;
  minimumScore: number | null;
  onMinimumScoreChange: (value: number | null) => void;
  hideRecurring: boolean;
  onHideRecurringToggle: () => void;
  categoryOptions: Array<{ label: string; value: string }>;
  metaTrendOptions: Array<{ label: string; value: string }>;
  audienceOptions: Array<{ label: string; value: string }>;
  marketOptions: Array<{ label: string; value: string }>;
  languageOptions: Array<{ label: string; value: string }>;
  activeFilters: ExplorerActiveFilter[];
  onClearFilter: (key: string) => void;
  onClearAllFilters: () => void;
};

export function ExplorerFilters({
  keyword,
  onKeywordChange,
  selectedSource,
  onSourceChange,
  selectedCategory,
  onCategoryChange,
  selectedStage,
  onStageChange,
  selectedStatus,
  onStatusChange,
  selectedConfidence,
  onConfidenceChange,
  selectedLens,
  onLensChange,
  selectedMetaTrend,
  onMetaTrendChange,
  selectedAudience,
  onAudienceChange,
  selectedMarket,
  onMarketChange,
  selectedLanguage,
  onLanguageChange,
  sortBy,
  onSortChange,
  sortDirection,
  onSortDirectionToggle,
  minimumScore,
  onMinimumScoreChange,
  hideRecurring,
  onHideRecurringToggle,
  categoryOptions,
  metaTrendOptions,
  audienceOptions,
  marketOptions,
  languageOptions,
  activeFilters,
  onClearFilter,
  onClearAllFilters,
}: ExplorerFiltersProps) {
  const selectedSourceLabel = getOptionLabel(
    SOURCE_FILTER_OPTIONS,
    selectedSource,
    "All sources",
  );
  const selectedCategoryLabel = getOptionLabel(
    categoryOptions,
    selectedCategory,
    "All categories",
  );
  const selectedStageLabel = getOptionLabel(
    STAGE_OPTIONS,
    selectedStage,
    "All stages",
  );
  const selectedConfidenceLabel = getOptionLabel(
    CONFIDENCE_OPTIONS,
    selectedConfidence,
    "All confidence",
  );
  const selectedLensLabel = getOptionLabel(
    LENS_OPTIONS,
    selectedLens,
    "All lenses",
  );
  const selectedMetaTrendLabel = getOptionLabel(
    metaTrendOptions,
    selectedMetaTrend,
    "All meta trends",
  );
  const selectedAudienceLabel = getOptionLabel(
    audienceOptions,
    selectedAudience,
    "All audiences",
  );
  const selectedMarketLabel = getOptionLabel(
    marketOptions,
    selectedMarket,
    "All markets",
  );
  const selectedLanguageLabel = getOptionLabel(
    languageOptions,
    selectedLanguage,
    "All languages",
  );
  const selectedSortLabel = getOptionLabel(SORT_OPTIONS, sortBy, "Rank");
  const selectedStatusLabel = getOptionLabel(
    STATUS_OPTIONS,
    selectedStatus,
    "All statuses",
  );

  return (
    <>
      <details className="advanced-filters-panel">
        <summary>
          <span>Advanced filters</span>
          <small>
            {activeFilters.length > 0
              ? `${activeFilters.length} active`
              : "Keyword, source, scoring, and audience controls"}
          </small>
          <span aria-hidden="true" className="advanced-filters-chevron">
            &#9662;
          </span>
        </summary>
        <section className="advanced-filters-grid filters-panel-wide">
          <label className="filter-field">
            <span>Keyword</span>
            <Input
              className="text-input"
              placeholder="AI agents, robotics, battery..."
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
            />
          </label>

          <label className="filter-field">
            <span>Source</span>
            <Select.Root
              value={selectedSource}
              onValueChange={(value) => onSourceChange(value ?? "all")}
            >
              <Select.Trigger className="select-trigger">
                <span>{selectedSourceLabel}</span>
                <Select.Icon className="select-icon">&#9660;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  className="select-positioner"
                  sideOffset={8}
                >
                  <Select.Popup className="select-popup">
                    <Select.List className="select-list">
                      {SOURCE_FILTER_OPTIONS.map((option) => (
                        <Select.Item
                          className="select-item"
                          key={option.value}
                          value={option.value}
                        >
                          <Select.ItemText>
                            {option.label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </label>

          <label className="filter-field">
            <span>Category</span>
            <Select.Root
              value={selectedCategory}
              onValueChange={(value) =>
                onCategoryChange(value ?? "all")
              }
            >
              <Select.Trigger className="select-trigger">
                <span>{selectedCategoryLabel}</span>
                <Select.Icon className="select-icon">&#9660;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  className="select-positioner"
                  sideOffset={8}
                >
                  <Select.Popup className="select-popup">
                    <Select.List className="select-list">
                      {categoryOptions.map((option) => (
                        <Select.Item
                          className="select-item"
                          key={option.value}
                          value={option.value}
                        >
                          <Select.ItemText>
                            {option.label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </label>

          <label className="filter-field">
            <span>Stage</span>
            <Select.Root
              value={selectedStage}
              onValueChange={(value) => onStageChange(value ?? "all")}
            >
              <Select.Trigger className="select-trigger">
                <span>{selectedStageLabel}</span>
                <Select.Icon className="select-icon">&#9660;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  className="select-positioner"
                  sideOffset={8}
                >
                  <Select.Popup className="select-popup">
                    <Select.List className="select-list">
                      {STAGE_OPTIONS.map((option) => (
                        <Select.Item
                          className="select-item"
                          key={option.value}
                          value={option.value}
                        >
                          <Select.ItemText>
                            {option.label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </label>

          <label className="filter-field">
            <span>Status</span>
            <Select.Root
              value={selectedStatus}
              onValueChange={(value) =>
                onStatusChange(value ?? "all")
              }
            >
              <Select.Trigger className="select-trigger">
                <span>{selectedStatusLabel}</span>
                <Select.Icon className="select-icon">&#9660;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  className="select-positioner"
                  sideOffset={8}
                >
                  <Select.Popup className="select-popup">
                    <Select.List className="select-list">
                      {STATUS_OPTIONS.map((option) => (
                        <Select.Item
                          className="select-item"
                          key={option.value}
                          value={option.value}
                        >
                          <Select.ItemText>
                            {option.label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </label>

          <label className="filter-field">
            <span>Confidence</span>
            <Select.Root
              value={selectedConfidence}
              onValueChange={(value) =>
                onConfidenceChange(value ?? "all")
              }
            >
              <Select.Trigger className="select-trigger">
                <span>{selectedConfidenceLabel}</span>
                <Select.Icon className="select-icon">&#9660;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  className="select-positioner"
                  sideOffset={8}
                >
                  <Select.Popup className="select-popup">
                    <Select.List className="select-list">
                      {CONFIDENCE_OPTIONS.map((option) => (
                        <Select.Item
                          className="select-item"
                          key={option.value}
                          value={option.value}
                        >
                          <Select.ItemText>
                            {option.label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </label>

          <label className="filter-field">
            <span>Lens</span>
            <Select.Root
              value={selectedLens}
              onValueChange={(value) => onLensChange(value ?? "all")}
            >
              <Select.Trigger className="select-trigger">
                <span>{selectedLensLabel}</span>
                <Select.Icon className="select-icon">&#9660;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  className="select-positioner"
                  sideOffset={8}
                >
                  <Select.Popup className="select-popup">
                    <Select.List className="select-list">
                      {LENS_OPTIONS.map((option) => (
                        <Select.Item
                          className="select-item"
                          key={option.value}
                          value={option.value}
                        >
                          <Select.ItemText>
                            {option.label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </label>

          <label className="filter-field">
            <span>Meta trend</span>
            <Select.Root
              value={selectedMetaTrend}
              onValueChange={(value) =>
                onMetaTrendChange(value ?? "all")
              }
            >
              <Select.Trigger className="select-trigger">
                <span>{selectedMetaTrendLabel}</span>
                <Select.Icon className="select-icon">&#9660;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  className="select-positioner"
                  sideOffset={8}
                >
                  <Select.Popup className="select-popup">
                    <Select.List className="select-list">
                      {metaTrendOptions.map((option) => (
                        <Select.Item
                          className="select-item"
                          key={option.value}
                          value={option.value}
                        >
                          <Select.ItemText>
                            {option.label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </label>

          <label className="filter-field">
            <span>Audience</span>
            <Select.Root
              value={selectedAudience}
              onValueChange={(value) =>
                onAudienceChange(value ?? "all")
              }
            >
              <Select.Trigger className="select-trigger">
                <span>{selectedAudienceLabel}</span>
                <Select.Icon className="select-icon">&#9660;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  className="select-positioner"
                  sideOffset={8}
                >
                  <Select.Popup className="select-popup">
                    <Select.List className="select-list">
                      {audienceOptions.map((option) => (
                        <Select.Item
                          className="select-item"
                          key={option.value}
                          value={option.value}
                        >
                          <Select.ItemText>
                            {option.label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </label>

          <label className="filter-field">
            <span>Market</span>
            <Select.Root
              value={selectedMarket}
              onValueChange={(value) => onMarketChange(value ?? "all")}
            >
              <Select.Trigger className="select-trigger">
                <span>{selectedMarketLabel}</span>
                <Select.Icon className="select-icon">&#9660;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  className="select-positioner"
                  sideOffset={8}
                >
                  <Select.Popup className="select-popup">
                    <Select.List className="select-list">
                      {marketOptions.map((option) => (
                        <Select.Item
                          className="select-item"
                          key={option.value}
                          value={option.value}
                        >
                          <Select.ItemText>
                            {option.label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </label>

          <label className="filter-field">
            <span>Language</span>
            <Select.Root
              value={selectedLanguage}
              onValueChange={(value) =>
                onLanguageChange(value ?? "all")
              }
            >
              <Select.Trigger className="select-trigger">
                <span>{selectedLanguageLabel}</span>
                <Select.Icon className="select-icon">&#9660;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  className="select-positioner"
                  sideOffset={8}
                >
                  <Select.Popup className="select-popup">
                    <Select.List className="select-list">
                      {languageOptions.map((option) => (
                        <Select.Item
                          className="select-item"
                          key={option.value}
                          value={option.value}
                        >
                          <Select.ItemText>
                            {option.label}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </label>

          <label className="filter-field">
            <span>Sort</span>
            <span
              style={{
                display: "flex",
                gap: "0.25rem",
                alignItems: "center",
              }}
            >
              <Select.Root
                value={sortBy}
                onValueChange={(value) =>
                  onSortChange(value ?? "rank")
                }
              >
                <Select.Trigger className="select-trigger">
                  <span>{selectedSortLabel}</span>
                  <Select.Icon className="select-icon">&#9660;</Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner
                    className="select-positioner"
                    sideOffset={8}
                  >
                    <Select.Popup className="select-popup">
                      <Select.List className="select-list">
                        {SORT_OPTIONS.map((option) => (
                          <Select.Item
                            className="select-item"
                            key={option.value}
                            value={option.value}
                          >
                            <Select.ItemText>
                              {option.label}
                            </Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.List>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
              <button
                className="toggle-chip"
                type="button"
                onClick={onSortDirectionToggle}
                title={
                  sortDirection === "asc" ? "Ascending" : "Descending"
                }
                style={{ minWidth: "2rem", textAlign: "center" }}
              >
                {sortDirection === "asc" ? "\u2191" : "\u2193"}
              </button>
            </span>
          </label>

          <label className="filter-field">
            <span>Minimum score</span>
            <NumberField.Root
              className="number-field"
              min={0}
              value={minimumScore}
              onValueChange={onMinimumScoreChange}
            >
              <NumberField.Group className="number-group">
                <NumberField.Decrement className="number-button">
                  -
                </NumberField.Decrement>
                <NumberField.Input className="number-input" />
                <NumberField.Increment className="number-button">
                  +
                </NumberField.Increment>
              </NumberField.Group>
            </NumberField.Root>
          </label>

          <label className="filter-field filter-checkbox-field">
            <span>Seasonality</span>
            <button
              className={
                hideRecurring
                  ? "toggle-chip toggle-chip-active"
                  : "toggle-chip"
              }
              onClick={onHideRecurringToggle}
              type="button"
            >
              {hideRecurring ? "Hiding recurring" : "Hide recurring"}
            </button>
          </label>
        </section>
      </details>

      {activeFilters.length > 0 ? (
        <section
          className="explorer-active-filters"
          aria-label="Active explorer filters"
        >
          <div className="community-chip-group">
            {activeFilters.map((filter) => (
              <button
                className="community-filter-chip"
                key={filter.key}
                onClick={() => onClearFilter(filter.key)}
                type="button"
              >
                {filter.label}: {filter.value}{" "}
                <span aria-hidden="true">x</span>
              </button>
            ))}
          </div>
          <button
            className="source-summary-copy detail-button-link"
            onClick={onClearAllFilters}
            type="button"
          >
            Clear all
          </button>
        </section>
      ) : null}
    </>
  );
}
