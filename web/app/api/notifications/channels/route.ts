import { NextResponse } from "next/server";

import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import {
  createNotificationChannel,
  getErrorStatus,
  listNotificationChannels,
} from "@/lib/server/notification-service";

type NotificationChannelsRouteDependencies = {
  listNotificationChannels: typeof listNotificationChannels;
  createNotificationChannel: typeof createNotificationChannel;
};

export async function handleNotificationChannelsGet(
  request: Request,
  dependencies: NotificationChannelsRouteDependencies = {
    listNotificationChannels,
    createNotificationChannel,
  },
) {
  try {
    const payload = await dependencies.listNotificationChannels({
      apiHeaders: await buildForwardedAuthHeaders(request),
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = "Notification channels unavailable";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function GET(request: Request) {
  return handleNotificationChannelsGet(request);
}

export async function handleNotificationChannelsPost(
  request: Request,
  dependencies: NotificationChannelsRouteDependencies = {
    listNotificationChannels,
    createNotificationChannel,
  },
) {
  try {
    const body = (await request.json()) as { destination?: string; label?: string };
    const payload = await dependencies.createNotificationChannel(
      body.destination ?? "",
      body.label ?? "",
      {
        apiHeaders: await buildForwardedAuthHeaders(request),
      },
    );
    return NextResponse.json(payload);
  } catch (error) {
    const message = "Notification channel request failed";
    return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
  }
}

export async function POST(request: Request) {
  return handleNotificationChannelsPost(request);
}
