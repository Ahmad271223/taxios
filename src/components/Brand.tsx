import Link from "next/link";

export function Brand({
  href = "/",
  subtitle,
  tone = "dark",
}: {
  href?: string;
  subtitle?: string;
  tone?: "dark" | "light";
}) {
  const title = tone === "light" ? "text-white" : "text-ink-900";
  const sub = tone === "light" ? "text-ink-300" : "text-ink-500";
  const accent = tone === "light" ? "text-brand-400" : "text-brand-600";
  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-300 to-brand-500 text-xl shadow-glow ring-1 ring-white/30 transition group-hover:scale-105">
        🚕
      </span>
      <span className="leading-tight">
        <span className={`block text-lg font-extrabold tracking-tight ${title}`}>
          Taxi<span className={accent}>Connect</span>
        </span>
        {subtitle && <span className={`block text-xs font-semibold ${sub}`}>{subtitle}</span>}
      </span>
    </Link>
  );
}
