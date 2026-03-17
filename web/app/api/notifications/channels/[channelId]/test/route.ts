import { NextResponse } from "next/server";

import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import { getErrorStatus, testNotificationChannel } from "@/lib/server/notification-service";

type TestNotificationChannelRouteDependencies = {
  testNotificationChannel: typeof testNotificationChannel;
};

export async function handleNotificationChannelTestPost(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
  dependencies: TestNotificationChannelRouteDependencies = { testNotificationChannel },
) {
  try {
    const { channelId } = await context.params;
    const payload = await dependencies.testNotificationChannel(Number(channelId), {
      apiHeaders: await buildForwardedAuthHeaders(request),
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = "Notification channel request failed";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  return handleNotificationChannelTestPost(request, context);
}
