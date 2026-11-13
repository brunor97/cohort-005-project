// PROTOTYPE — throwaway. Answers "what do in-app Notifications look like in
// Cadence, and is 'dismiss' separate from 'read'?" for the wayfinder ticket
// "Prototype the in-app Notification UI". Three variants, switchable via
// ?variant=A|B|C (or the floating bar / ← → keys). Fake, in-memory data only:
// no Novu, nothing persisted. Lives on branch prototype/notification-ui.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Plus,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { UserRole } from "~/db/schema";

// ─── Fake data ───

export type ProtoNotification = {
  id: number;
  title: string;
  body: string;
  href: string;
  minutesAgo: number;
  read: boolean;
  archived: boolean;
};

type Seed = Omit<ProtoNotification, "id" | "read" | "archived">;

const SEEDS: Record<"student" | "instructor" | "platformAdmin" | "teamAdmin", Seed[]> = {
  student: [
    { title: "Refund Request approved", body: "Your Refund Request for “TypeScript Deep Dive” was approved. Your Refund of $49.00 is on its way.", href: "/dashboard", minutesAgo: 4 },
    { title: "New reply to your comment", body: "Ana replied on “Generics, part 2”: “Good question! The trick is…”", href: "/courses", minutesAgo: 95 },
    { title: "Refund issued", body: "$49.00 has been sent back to your card.", href: "/dashboard", minutesAgo: 60 * 26 },
    { title: "Refund Request declined", body: "Your Refund Request for “React Patterns” was declined: you are past the Watch Limit.", href: "/dashboard", minutesAgo: 60 * 24 * 6 },
  ],
  instructor: [
    { title: "New question on “TypeScript Deep Dive”", body: "Sam asked on “Conditional types”: “Why does this distribute over the union?”", href: "/instructor/questions", minutesAgo: 2 },
    { title: "New Enrollment", body: "Priya enrolled on “TypeScript Deep Dive”.", href: "/instructor", minutesAgo: 40 },
    { title: "New Enrollment", body: "Leo enrolled on “React Patterns”.", href: "/instructor", minutesAgo: 60 * 5 },
    { title: "New comment on “React Patterns”", body: "Kim commented on “Compound components”.", href: "/instructor/questions", minutesAgo: 60 * 30 },
  ],
  platformAdmin: [
    { title: "New Refund Request", body: "Jordan asked for a Refund on “TypeScript Deep Dive” ($49.00): “Not what I expected.”", href: "/admin/refunds", minutesAgo: 7 },
    { title: "Refund failed", body: "The Refund for Jordan's Purchase of “React Patterns” could not be sent.", href: "/admin/refunds", minutesAgo: 60 * 3 },
    { title: "New Refund Request", body: "Acme Ltd asked for a Refund on a Team Licence (5 Seats).", href: "/admin/refunds", minutesAgo: 60 * 28 },
  ],
  teamAdmin: [
    { title: "Seat claimed", body: "maria@acme.dev claimed a Seat on “TypeScript Deep Dive” (3 of 5 claimed).", href: "/team", minutesAgo: 12 },
  ],
};

const INCOMING: Seed[] = [
  { title: "New reply to your comment", body: "Someone just replied to you on “Mapped types”.", href: "/courses", minutesAgo: 0 },
  { title: "New Refund Request", body: "A Student just asked for a Refund on “React Patterns”.", href: "/admin/refunds", minutesAgo: 0 },
  { title: "New Enrollment", body: "A Student just enrolled on “TypeScript Deep Dive”.", href: "/instructor", minutesAgo: 0 },
];

function seedFor(role: UserRole | null, isTeamAdmin: boolean): ProtoNotification[] {
  const seeds =
    role === UserRole.Admin
      ? SEEDS.platformAdmin
      : role === UserRole.Instructor
        ? SEEDS.instructor
        : [...(isTeamAdmin ? SEEDS.teamAdmin : []), ...SEEDS.student];
  return seeds.map((s, i) => ({ ...s, id: i + 1, read: i >= 2, archived: false }));
}

export function timeAgo(m: number) {
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 60 / 24)}d ago`;
}

// ─── Store (React context, in memory) ───

const VARIANTS = [
  { key: "A", name: "Bell popover — dismiss = read" },
  { key: "B", name: "Inbox page — read ≠ archived" },
  { key: "C", name: "Drawer + toasts — × archives" },
] as const;
type VariantKey = (typeof VARIANTS)[number]["key"];

type Store = {
  variant: VariantKey;
  items: ProtoNotification[];
  markRead: (id: number, read?: boolean) => void;
  archive: (id: number, archived?: boolean) => void;
  markAllRead: () => void;
  simulateIncoming: () => void;
};

const Ctx = createContext<Store | null>(null);
export function useProto() {
  const s = useContext(Ctx);
  if (!s) throw new Error("NotificationsPrototypeProvider missing");
  return s;
}

export function NotificationsPrototypeProvider({
  role,
  isTeamAdmin,
  children,
}: {
  role: UserRole | null;
  isTeamAdmin: boolean;
  children: ReactNode;
}) {
  const [params] = useSearchParams();
  const fromUrl = params.get("variant") as VariantKey | null;
  const [stored, setStored] = useState<VariantKey>("A");
  useEffect(() => {
    const v = localStorage.getItem("proto-notif-variant") as VariantKey | null;
    if (v) setStored(v);
  }, []);
  useEffect(() => {
    if (fromUrl) {
      localStorage.setItem("proto-notif-variant", fromUrl);
      setStored(fromUrl);
    }
  }, [fromUrl]);
  const variant: VariantKey = fromUrl ?? stored;

  const [items, setItems] = useState(() => seedFor(role, isTeamAdmin));
  useEffect(() => setItems(seedFor(role, isTeamAdmin)), [role, isTeamAdmin]);
  const nextId = useRef(100);
  const incomingIdx = useRef(0);

  const store: Store = {
    variant,
    items,
    markRead: (id, read = true) =>
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read } : x))),
    archive: (id, archived = true) =>
      setItems((xs) =>
        xs.map((x) => (x.id === id ? { ...x, archived, read: x.read || archived } : x))
      ),
    markAllRead: () => setItems((xs) => xs.map((x) => ({ ...x, read: true }))),
    simulateIncoming: () => {
      const seed = INCOMING[incomingIdx.current++ % INCOMING.length];
      const n = { ...seed, id: nextId.current++, read: false, archived: false };
      setItems((xs) => [n, ...xs]);
      if (variant === "C") {
        toast(n.title, { description: n.body, action: { label: "View", onClick: () => (window.location.href = n.href) } });
      }
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span className={cn("flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white", className)}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

// ─── Variant A: bell in the sidebar header, popover list. Dismiss = read. ───

function VariantABell() {
  const { items, markRead, markAllRead } = useProto();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unread = items.filter((x) => !x.read).length;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        title="Notifications"
      >
        <Bell className="size-4" />
        <UnreadBadge count={unread} className="absolute -right-1 -top-1" />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all as read
            </button>
          </div>
          <ul className="max-h-[28rem] overflow-y-auto">
            {items.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    markRead(n.id);
                    setOpen(false);
                    navigate(n.href);
                  }}
                  className={cn("flex w-full gap-3 border-b px-4 py-3 text-left hover:bg-muted", !n.read && "bg-primary/5")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.read && "font-semibold")}>{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.minutesAgo)}</span>
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

// ─── Variant B: sidebar nav item with count → full /notifications page. ───

function VariantBNavItem() {
  const { items } = useProto();
  const unread = items.filter((x) => !x.read && !x.archived).length;
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Inbox className="size-4" />
      <span className="flex-1">Notifications</span>
      <UnreadBadge count={unread} />
    </NavLink>
  );
}

export function VariantBPage() {
  const { items, markRead, archive, markAllRead } = useProto();
  const [tab, setTab] = useState<"unread" | "all" | "archived">("unread");
  const shown = items.filter((n) =>
    tab === "archived" ? n.archived : tab === "unread" ? !n.read && !n.archived : !n.archived
  );
  const counts = {
    unread: items.filter((n) => !n.read && !n.archived).length,
    all: items.filter((n) => !n.archived).length,
    archived: items.filter((n) => n.archived).length,
  };
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button onClick={markAllRead} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          <CheckCheck className="size-4" /> Mark all as read
        </button>
      </div>
      <div className="mb-4 flex gap-1 border-b">
        {(["unread", "all", "archived"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("-mb-px border-b-2 px-4 py-2 text-sm capitalize", tab === t ? "border-primary font-semibold" : "border-transparent text-muted-foreground")}
          >
            {t} <span className="text-xs text-muted-foreground">({counts[t]})</span>
          </button>
        ))}
      </div>
      <ul className="divide-y rounded-lg border">
        {shown.length === 0 && <li className="p-10 text-center text-sm text-muted-foreground">Nothing here.</li>}
        {shown.map((n) => (
          <li key={n.id} className={cn("group flex items-start gap-4 p-4", !n.read && "bg-primary/5")}>
            <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
            <Link to={n.href} onClick={() => markRead(n.id)} className="min-w-0 flex-1">
              <div className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</div>
              <div className="text-sm text-muted-foreground">{n.body}</div>
              <div className="mt-1 text-xs text-muted-foreground">{timeAgo(n.minutesAgo)}</div>
            </Link>
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button title={n.read ? "Mark as unread" : "Mark as read"} onClick={() => markRead(n.id, !n.read)} className="rounded p-1.5 hover:bg-muted">
                <Check className="size-4" />
              </button>
              <button title={n.archived ? "Unarchive" : "Archive"} onClick={() => archive(n.id, !n.archived)} className="rounded p-1.5 hover:bg-muted">
                {n.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">Notifications older than 30 days disappear.</p>
    </div>
  );
}

// ─── Variant C: bell in sidebar footer → right-hand drawer; × archives; toasts on arrival. ───

function VariantCBell() {
  const { items, markRead, archive, markAllRead } = useProto();
  const [open, setOpen] = useState(false);
  const live = items.filter((n) => !n.archived);
  const unread = live.filter((n) => !n.read).length;
  const today = live.filter((n) => n.minutesAgo < 60 * 24);
  const earlier = live.filter((n) => n.minutesAgo >= 60 * 24);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-4" />
        <span className="flex-1 text-left">Notifications</span>
        <UnreadBadge count={unread} />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-[26rem] flex-col bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <div className="flex items-center gap-2">
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all as read</button>
                <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted"><X className="size-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {live.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">You're all caught up.</p>}
              {[["Today", today], ["Earlier", earlier]].map(([label, group]) =>
                (group as ProtoNotification[]).length === 0 ? null : (
                  <section key={label as string} className="mb-4">
                    <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label as string}</div>
                    <div className="space-y-2">
                      {(group as ProtoNotification[]).map((n) => (
                        <div key={n.id} className={cn("relative rounded-lg border p-3 pr-8", !n.read ? "border-primary/40 bg-primary/5" : "opacity-80")}>
                          <Link to={n.href} onClick={() => { markRead(n.id); setOpen(false); }} className="block">
                            <div className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</div>
                            <div className="text-xs text-muted-foreground">{n.body}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.minutesAgo)}</div>
                          </Link>
                          <button title="Dismiss" onClick={() => archive(n.id)} className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted">
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ─── Slots the sidebar renders; each variant fills a different one. ───

export function NotificationsHeaderSlot() {
  return useProto().variant === "A" ? <VariantABell /> : null;
}
export function NotificationsNavSlot() {
  return useProto().variant === "B" ? <VariantBNavItem /> : null;
}
export function NotificationsFooterSlot() {
  return useProto().variant === "C" ? <VariantCBell /> : null;
}

// ─── Floating switcher (dev only) ───

export function PrototypeSwitcher() {
  const { variant, items, simulateIncoming } = useProto();
  const [, setParams] = useSearchParams();
  const idx = VARIANTS.findIndex((v) => v.key === variant);
  const go = (d: number) => {
    const next = VARIANTS[(idx + d + VARIANTS.length) % VARIANTS.length].key;
    setParams((p) => { p.set("variant", next); return p; }, { replace: true });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (process.env.NODE_ENV === "production") return null;
  const unread = items.filter((n) => !n.read && !n.archived).length;
  const archived = items.filter((n) => n.archived).length;
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-3 py-2 text-sm text-white shadow-2xl ring-2 ring-fuchsia-500">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/10"><ChevronLeft className="size-4" /></button>
      <span className="min-w-64 text-center font-medium">{variant} ({VARIANTS[idx]?.name})</span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/10"><ChevronRight className="size-4" /></button>
      <span className="mx-1 h-4 w-px bg-white/30" />
      <span className="text-xs text-white/70">unread {unread} · archived {archived} · total {items.length}</span>
      <button onClick={simulateIncoming} className="ml-1 flex items-center gap-1 rounded-full bg-fuchsia-600 px-2.5 py-1 text-xs hover:bg-fuchsia-500">
        <Plus className="size-3" /> Simulate new
      </button>
    </div>
  );
}
