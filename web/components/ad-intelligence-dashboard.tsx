"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/components/profile-provider";
import type { AdIntelligenceResponse } from "@/lib/types";

export function AdIntelligenceDashboard() {
  const { isPro, loading: profileLoading } = useProfile();
  const [data, setData] = useState<AdIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPro) {
      setLoading(false);
      return;
    }
    fetch("/api/ad-intelligence")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isPro]);

  if (profileLoading || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96" />
          <div className="grid grid-cols-4 gap-4 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-4">Ad Intelligence</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
          See what your competitors are paying for
        </p>
        <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 p-8 mb-8 overflow-hidden">
          <div className="absolute inset-0 backdrop-blur-md bg-white/60 dark:bg-gray-900/60 z-10" />
          <div className="relative z-0 opacity-40 space-y-3">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-4">
                <div className="text-sm text-gray-500">Tracked Keywords</div>
                <div className="text-2xl font-bold">247</div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-4">
                <div className="text-sm text-gray-500">Avg CPC</div>
                <div className="text-2xl font-bold">$6.42</div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-4">
                <div className="text-sm text-gray-500">Advertisers</div>
                <div className="text-2xl font-bold">89</div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-4">
                <div className="text-sm text-gray-500">Top Platform</div>
                <div className="text-2xl font-bold">Google</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2">Keyword</th>
                  <th className="text-right py-2">CPC</th>
                  <th className="text-right py-2">Volume</th>
                  <th className="text-right py-2">Competition</th>
                </tr>
              </thead>
              <tbody>
                {["AI automation", "cloud security", "low-code platform"].map((kw) => (
                  <tr key={kw} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2">{kw}</td>
                    <td className="text-right">$--</td>
                    <td className="text-right">--</td>
                    <td className="text-right">--</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold mb-3">Unlock Ad Intelligence</p>
              <a
                href="/pricing"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Upgrade to Pro
              </a>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Pro members get full access to keyword CPC data, advertiser breakdowns, ad copy trends, and cross-platform ad activity.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">
        No ad intelligence data available yet.
      </div>
    );
  }

  const totalKeywords = data.topKeywords.length;
  const avgCpc = totalKeywords > 0
    ? (data.topKeywords.reduce((sum, k) => sum + k.cpc, 0) / totalKeywords).toFixed(2)
    : "0.00";
  const totalAdvertisers = data.topAdvertisers.length;
  const topPlatform = data.platformSummary[0]?.platform ?? "N/A";

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ad Intelligence</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Keyword CPC data, advertiser breakdowns, and cross-platform ad activity
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Tracked Keywords</div>
          <div className="text-2xl font-bold mt-1">{totalKeywords}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Avg CPC</div>
          <div className="text-2xl font-bold mt-1">${avgCpc}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Advertisers</div>
          <div className="text-2xl font-bold mt-1">{totalAdvertisers}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Top Platform</div>
          <div className="text-2xl font-bold mt-1">{topPlatform}</div>
        </div>
      </div>

      {data.topKeywords.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold">Top Keywords</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-left px-4 py-2 font-medium">Keyword</th>
                  <th className="text-right px-4 py-2 font-medium">CPC</th>
                  <th className="text-right px-4 py-2 font-medium">Search Volume</th>
                  <th className="text-right px-4 py-2 font-medium">Competition</th>
                  <th className="text-right px-4 py-2 font-medium">Ad Density</th>
                  <th className="text-left px-4 py-2 font-medium">Platforms</th>
                </tr>
              </thead>
              <tbody>
                {data.topKeywords.map((kw) => (
                  <tr key={kw.keyword} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-2">
                      {kw.trendId ? (
                        <a href={`/trends/${kw.trendId}`} className="text-blue-600 hover:underline">{kw.keyword}</a>
                      ) : (
                        kw.keyword
                      )}
                    </td>
                    <td className="text-right px-4 py-2">${kw.cpc.toFixed(2)}</td>
                    <td className="text-right px-4 py-2">{kw.searchVolume.toLocaleString()}</td>
                    <td className="text-right px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                        kw.competitionLevel === "HIGH" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                        kw.competitionLevel === "MEDIUM" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                        "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      }`}>
                        {kw.competitionLevel}
                      </span>
                    </td>
                    <td className="text-right px-4 py-2">{kw.adDensity}</td>
                    <td className="px-4 py-2">{kw.platforms.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.topAdvertisers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold">Top Advertisers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-left px-4 py-2 font-medium">Advertiser</th>
                  <th className="text-left px-4 py-2 font-medium">Platform</th>
                  <th className="text-right px-4 py-2 font-medium">Ad Count</th>
                  <th className="text-left px-4 py-2 font-medium">Formats</th>
                  <th className="text-left px-4 py-2 font-medium">Regions</th>
                </tr>
              </thead>
              <tbody>
                {data.topAdvertisers.map((adv) => (
                  <tr key={`${adv.name}-${adv.platform}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-2 font-medium">{adv.name}</td>
                    <td className="px-4 py-2">{adv.platform}</td>
                    <td className="text-right px-4 py-2">{adv.adCount}</td>
                    <td className="px-4 py-2">{adv.adFormats.join(", ")}</td>
                    <td className="px-4 py-2">{adv.regions.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.platformSummary.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold">Platform Distribution</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
            {data.platformSummary.map((p) => (
              <div key={p.platform} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="font-medium">{p.platform}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {p.adCount} ads · {p.keywordCount} keywords · {p.advertiserCount} advertisers
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
