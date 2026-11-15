import { HugeiconsIcon } from "@hugeicons/react";
import type PlayIcon from "@hugeicons-pro/core-stroke-standard/PlayIcon";
import type { ReactNode } from "react";
import { AdminCard, AdminFrame } from "./AdminFrame";

/**
 * The one layout every admin list screen uses — proposals, reviews, pages,
 * invoices, models, boards, brand kits, collections, sites:
 *
 *   AdminListPage   the page: its icon and title on the left, its main
 *                   action on the right, then whatever it holds
 *   AdminList       the list: one card, its rows ruled apart
 *   AdminListRow    a row: title, a quiet line under it, a status, actions
 *   AdminRowAction  an icon button at a row's end (edit, delete, open)
 *   AdminRowLink    a text link at a row's end ("View")
 *   AdminStatus     a small-caps status word, coloured by what it means
 *   AdminEmpty      the sentence shown when the list has nothing in it
 *
 * A screen never draws its own page header, list card or row: it composes
 * these, so the screens look the same and change together.
 */

type Icon = typeof PlayIcon;

export function AdminListPage({
  action,
  aside,
  children,
  icon,
  title,
}: {
  /** The page's main action, e.g. a "New proposal" Button. */
  action?: ReactNode;
  /** A fact beside the action, e.g. "$800 outstanding". */
  aside?: ReactNode;
  children: ReactNode;
  icon: Icon;
  title: string;
}) {
  return (
    <AdminFrame>
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-light text-sm text-white/90 uppercase tracking-micro-widest">
          <HugeiconsIcon aria-hidden icon={icon} size={16} />
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          {aside}
          {action}
        </div>
      </header>
      {children}
    </AdminFrame>
  );
}

/** A sentence about the list, above it: what it is for, or a warning. */
export function AdminListNote({
  children,
  tone = "quiet",
}: {
  children: ReactNode;
  tone?: "quiet" | "warn";
}) {
  return (
    <p
      className={
        tone === "warn"
          ? "text-amber-300/80 text-sm leading-relaxed"
          : "text-sm text-white/60 leading-relaxed"
      }
    >
      {children}
    </p>
  );
}

/** A small-caps heading for a second list on the same page. */
export function AdminListHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-4 text-micro-md text-white/70 uppercase tracking-micro-widest">
      {children}
    </h3>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-white/80 uppercase leading-relaxed tracking-micro">
      {children}
    </p>
  );
}

/** The list: one card, rows ruled apart. Children are AdminListRows. */
export function AdminList({ children }: { children: ReactNode }) {
  return (
    <AdminCard flush>
      <ul className="divide-y divide-white/10">{children}</ul>
    </AdminCard>
  );
}

export function AdminListRow({
  actions,
  badges,
  below,
  indent = false,
  lead,
  meta,
  onOpen,
  status,
  title,
}: {
  /** AdminRowLinks and AdminRowActions, at the row's end. */
  actions?: ReactNode;
  /** Chips beside the title, e.g. "Default". */
  badges?: ReactNode;
  /** Shown under the row, inside it: a form opened for this row. */
  below?: ReactNode;
  /** A child of the row above, e.g. a sub-brand. */
  indent?: boolean;
  /** Before the title: a thumbnail, a swatch strip. */
  lead?: ReactNode;
  /** The quiet line under the title: a client, an address, a count. */
  meta?: ReactNode;
  /** Opens the thing; the title becomes a button when given. */
  onOpen?: () => void;
  /** An AdminStatus, or an amount. */
  status?: ReactNode;
  title: ReactNode;
}) {
  const text = (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <span className="truncate text-lg text-white leading-snug">
          {title}
        </span>
        {badges}
      </span>
      {meta ? (
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
          {meta}
        </span>
      ) : null}
    </>
  );
  return (
    <li className={indent ? "pl-8" : undefined}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5">
        {lead ? <div className="shrink-0">{lead}</div> : null}
        {onOpen ? (
          <button
            className="min-w-0 flex-1 text-left"
            onClick={onOpen}
            type="button"
          >
            {text}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{text}</div>
        )}
        {status ? (
          <div className="flex shrink-0 items-center gap-4">{status}</div>
        ) : null}
        {actions ? (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        ) : null}
      </div>
      {below ? <div className="px-6 pb-5">{below}</div> : null}
    </li>
  );
}

/** A piece of the meta line set in mono: an address, an id. */
export function AdminMono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-micro-lg">{children}</span>;
}

const STATUS_TONE = {
  /** Finished well: accepted, paid, live. */
  done: "text-emerald-400",
  /** Not out yet: a draft. */
  draft: "text-amber-400/70",
  /** Out and waiting: sent, open. */
  pending: "text-sky-400/90",
  /** Ready: published. */
  ready: "text-emerald-400/70",
  /** Over, without result: void, off. */
  void: "text-white/50",
} as const;

export function AdminStatus({
  children,
  tone,
}: {
  children: ReactNode;
  tone: keyof typeof STATUS_TONE;
}) {
  return (
    <span
      className={`shrink-0 text-sm uppercase tracking-micro-wide ${STATUS_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

const rowLink =
  "rounded-control px-3 py-2 text-sm text-white/90 uppercase tracking-micro-wide transition-colors hover:bg-white/5 hover:text-white";

/** A text link at a row's end; opens in a new tab. */
export function AdminRowLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <a className={rowLink} href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}

const rowAction =
  "rounded-control p-2 text-white/80 transition-colors hover:bg-white/5 disabled:pointer-events-none disabled:opacity-30 aria-pressed:bg-white/10 aria-pressed:text-white";

/** An icon button at a row's end. `danger` reddens on hover (delete). */
export function AdminRowAction({
  danger = false,
  disabled,
  href,
  icon,
  label,
  onClick,
  pressed,
}: {
  danger?: boolean;
  disabled?: boolean;
  /** Given instead of onClick: the action is a link, opened in a new tab. */
  href?: string;
  icon: Icon;
  /** Says what it does, for the tooltip and assistive tech. */
  label: string;
  onClick?: () => void;
  pressed?: boolean;
}) {
  const cls = `${rowAction} ${danger ? "hover:text-red-400" : "hover:text-white"}`;
  const glyph = <HugeiconsIcon aria-hidden icon={icon} size={18} />;
  if (href) {
    return (
      <a
        aria-label={label}
        className={cls}
        href={href}
        rel="noreferrer"
        target="_blank"
        title={label}
      >
        {glyph}
      </a>
    );
  }
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className={cls}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {glyph}
    </button>
  );
}
