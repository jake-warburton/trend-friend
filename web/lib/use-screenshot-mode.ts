import { useSearchParams } from "next/navigation";

export function useScreenshotMode(): boolean {
  const searchParams = useSearchParams();
  return (
    searchParams.get("screenshot") === "1" &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  );
}
