/**
 * Small, composable primitives used across pages. Tailwind v4-native; no
 * external component library, keeps the verifier dependency-minimal so the
 * "static and independent" property holds.
 */

import type { ReactNode } from 'react';

export function Card(props: { children: ReactNode; className?: string }) {
  return (
    <section
      className={[
        'rounded-xl border border-(--color-border-subtle) bg-(--color-bg-raised)/60 backdrop-blur-sm',
        'shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_4%,transparent)]',
        props.className ?? '',
      ].join(' ')}
    >
      {props.children}
    </section>
  );
}

export function CardHeader(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-(--color-border-subtle) px-4 py-4 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-5">
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-semibold leading-tight text-(--color-text-primary)">
          {props.title}
        </h2>
        {props.subtitle ? (
          <p className="mt-1 text-sm leading-snug text-(--color-text-secondary)">
            {props.subtitle}
          </p>
        ) : null}
      </div>
      {props.right ? <div className="shrink-0">{props.right}</div> : null}
    </header>
  );
}

export function CardBody(props: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-4 py-5 sm:px-6 sm:py-6 ${props.className ?? ''}`}>{props.children}</div>
  );
}

export function Label(props: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label
      htmlFor={props.htmlFor}
      className="flex flex-col gap-1.5 text-sm font-medium text-(--color-text-secondary)"
    >
      <span>{props.children}</span>
      {props.hint ? <span className="text-xs font-normal text-(--color-text-tertiary)">{props.hint}</span> : null}
    </label>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean },
) {
  const { mono, className, ...rest } = props;
  return (
    <input
      {...rest}
      className={[
        'w-full rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)',
        // 16px font-size on mobile prevents iOS Safari's auto-zoom on focus
        'min-h-[44px] px-3 py-2.5 text-base sm:min-h-0 sm:py-2 sm:text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary)',
        'transition focus:border-(--color-accent) focus:outline-none',
        mono ? 'font-mono' : '',
        className ?? '',
      ].join(' ')}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <select
      {...rest}
      className={[
        'w-full rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)',
        'min-h-[44px] px-3 py-2.5 text-base sm:min-h-0 sm:py-2 sm:text-sm text-(--color-text-primary)',
        'transition focus:border-(--color-accent) focus:outline-none',
        className ?? '',
      ].join(' ')}
    />
  );
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' },
) {
  const { variant = 'primary', className, ...rest } = props;
  const base =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-2';
  const styles =
    variant === 'primary'
      ? 'bg-(--color-accent) text-(--color-bg-base) hover:bg-(--color-accent-strong)'
      : 'border border-(--color-border-strong) bg-(--color-bg-elevated) text-(--color-text-primary) hover:bg-(--color-bg-elevated)/80';
  return <button {...rest} className={[base, styles, className ?? ''].join(' ')} />;
}

export function Badge(props: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const tone = props.tone ?? 'neutral';
  const tones: Record<string, string> = {
    neutral: 'bg-(--color-bg-elevated) text-(--color-text-secondary)',
    success: 'bg-(--color-accent)/12 text-(--color-accent)',
    warning: 'bg-(--color-warning)/15 text-(--color-warning)',
    danger: 'bg-(--color-danger)/15 text-(--color-danger)',
    info: 'bg-(--color-info)/15 text-(--color-info)',
  };
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider',
        tones[tone]!,
      ].join(' ')}
    >
      {props.children}
    </span>
  );
}

export function Hash({ value }: { value: string }) {
  return (
    <code className="block break-all rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/80 px-3 py-2 font-mono text-xs text-(--color-text-primary)">
      {value}
    </code>
  );
}

export function KeyValue(props: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wider text-(--color-text-tertiary)">{props.k}</dt>
      <dd className="text-sm text-(--color-text-primary)">{props.v}</dd>
    </div>
  );
}
