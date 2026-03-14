import { NextResponse } from "next/server";

import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import { deleteNotificationChannel, getErrorStatus } from "@/lib/server/notification-service";

type DeleteNotificationChannelRouteDependencies = {
  deleteNotificationChannel: typeof deleteNotificationChannel;
};

export async function handleNotificationChannelDelete(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
  dependencies: DeleteNotificationChannelRouteDependencies = { deleteNotificationChannel },
) {
  try {
    const { channelId } = await context.params;
    const payload = await dependencies.deleteNotificationChannel(Number(channelId), {
      apiHeaders: await buildForwardedAuthHeaders(request),
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification channel request failed";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  return handleNotificationChannelDelete(request, context);
}
