import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  NovuProvider,
  useCounts,
  useNotifications,
  type Notification as NovuNotification,
} from "@novu/react/hooks";
import { Bell, UserRound } from "lucide-react";
import { cn } from "~/lib/utils";
import type { FeedCredentials } from "~/lib/notifications.server";

// ─── In-app Notifications bell (sidebar header) ───
// Headless @novu/react hooks styled after prototype Variant A. Read model is
// unread → read only: no archive, snooze, mark-as-unread or "seen" state.
// See docs/adr/0013.

export function NotificationBell({
  credentials,
}: {
  credentials: FeedCredentials;
}) {
  // Novu's client opens a WebSocket, so only mount it in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <BellButton unread={0} onClick={() => {}} />;

  return (
    // Keyed on subscriberId: a DevUI user switch remounts it with the new feed.
    <NovuProvider
      key={credentials.subscriberId}
      applicationIdentifier={credentials.applicationIdentifier}
      subscriber={credentials.subscriberId}
      subscriberHash={credentials.subscriberHash}
    >
      <Feed />
    </NovuProvider>
  );
}

function Feed() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { counts } = useCounts({ filters: [{ read: false }] });
  const { notifications, isLoading, readAll } = useNotifications({
    archived: false,
  });
  const unread = counts?.[0]?.count ?? 0;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function openNotification(notification: NovuNotification) {
    setOpen(false);
    if (!notification.isRead) await notification.read();
    const link = notification.redirect?.url;
    if (link) navigate(link);
  }

  return (
    <div ref={containerRef} className="relative">
      <BellButton unread={unread} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="absolute left-0 top-9 z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              onClick={() => readAll()}
              disabled={unread === 0}
              className="text-xs text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Mark all as read
            </button>
          </div>
          <ul className="max-h-[28rem] overflow-y-auto">
            {isLoading && !notifications && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                Loading…
              </li>
            )}
            {notifications?.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                You're all caught up.
              </li>
            )}
            {notifications?.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openNotification(n)}
                  className={cn(
                    "flex w-full gap-3 border-b px-4 py-3 text-left hover:bg-muted",
                    !n.isRead && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-3 size-2 shrink-0 rounded-full",
                      n.isRead ? "bg-transparent" : "bg-primary"
                    )}
                  />
                  <ActorAvatar url={n.avatar} />
                  <span
                    className={cn(
                      "min-w-0 flex-1",
                      n.isRead && "text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn("block text-sm", !n.isRead && "font-semibold")}
                    >
                      {n.subject}
                    </span>
                    <span className="line-clamp-2 block text-xs text-muted-foreground">
                      {n.body}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="px-4 py-2 text-center text-[11px] text-muted-foreground">
            Notifications older than 30 days disappear.
          </div>
        </div>
      )}
    </div>
  );
}

function BellButton({
  unread,
  onClick,
}: {
  unread: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
      title="Notifications"
      aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
    >
      <Bell className="size-4" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

function ActorAvatar({ url }: { url?: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="size-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <UserRound className="size-4" />
    </span>
  );
}

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 60 / 24)}d ago`;
}
