type ExplorerPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function ExplorerPagination({
  currentPage,
  totalPages,
  onPageChange,
}: ExplorerPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="explorer-pagination" aria-label="Explorer pagination">
      <button
        className="explorer-pagination-button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(1)}
        type="button"
        aria-label="First page"
      >
        &laquo;
      </button>
      <button
        className="explorer-pagination-button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        type="button"
        aria-label="Previous page"
      >
        &lsaquo;
      </button>
      {(() => {
        const pages: number[] = [];
        const windowSize = 2;
        const start = Math.max(1, currentPage - windowSize);
        const end = Math.min(totalPages, currentPage + windowSize);
        if (start > 1) pages.push(1);
        if (start > 2) pages.push(-1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push(-2);
        if (end < totalPages) pages.push(totalPages);
        return pages.map((p) =>
          p < 0 ? (
            <span className="explorer-pagination-ellipsis" key={p}>
              &hellip;
            </span>
          ) : (
            <button
              className={
                p === currentPage
                  ? "explorer-pagination-button explorer-pagination-current"
                  : "explorer-pagination-button"
              }
              key={p}
              onClick={() => onPageChange(p)}
              type="button"
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </button>
          ),
        );
      })()}
      <button
        className="explorer-pagination-button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        type="button"
        aria-label="Next page"
      >
        &rsaquo;
      </button>
      <button
        className="explorer-pagination-button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(totalPages)}
        type="button"
        aria-label="Last page"
      >
        &raquo;
      </button>
    </nav>
  );
}
