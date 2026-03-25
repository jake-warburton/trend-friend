const ENABLED_FLAG = "true";

export function isServerRefreshLoopEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.SIGNAL_EYE_ENABLE_SERVER_REFRESH_LOOP === ENABLED_FLAG;
}

export function isDashboardAutoRefreshEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.NEXT_PUBLIC_SIGNAL_EYE_ENABLE_DASHBOARD_POLLING === ENABLED_FLAG
  );
}

export function isBreakingFeedAutoRefreshEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.NEXT_PUBLIC_SIGNAL_EYE_ENABLE_BREAKING_FEED_POLLING === ENABLED_FLAG
  );
}
