import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  theme: number;
  className?: string;
  /** Make the card clickable */
  onClick?: () => void;
}

const THEMES = [
  "bg-gradient-to-br from-cyan-900/60 via-teal-900/40 to-indigo-900/60 backdrop-blur-xl border border-cyan-400/30 shadow-cyan-400/20",
  "bg-gradient-to-tr from-green-900/60 via-emerald-900/40 to-teal-900/60 backdrop-blur-xl border border-emerald-400/30 shadow-emerald-400/20",
  "bg-gradient-to-bl from-purple-900/60 via-pink-900/40 to-indigo-900/60 backdrop-blur-xl border border-purple-400/30 shadow-purple-400/20",
  "bg-gradient-to-tl from-blue-900/60 via-cyan-900/40 to-teal-900/60 backdrop-blur-xl border border-blue-400/30 shadow-blue-400/20",
  "bg-gradient-to-r from-orange-900/60 via-red-900/40 to-pink-900/60 backdrop-blur-xl border border-orange-400/30 shadow-orange-400/20",
  "bg-gradient-to-l from-yellow-900/60 via-amber-900/40 to-orange-900/60 backdrop-blur-xl border border-yellow-400/30 shadow-yellow-400/20",
  "bg-gradient-to-b from-lime-900/60 via-green-900/40 to-teal-900/60 backdrop-blur-xl border border-lime-400/30 shadow-lime-400/20",
  "bg-gradient-to-br from-fuchsia-900/60 via-purple-900/40 to-indigo-900/60 backdrop-blur-xl border border-fuchsia-400/30 shadow-fuchsia-400/20",
  "bg-gradient-to-tr from-pink-900/60 via-rose-900/40 to-purple-900/60 backdrop-blur-xl border border-pink-400/30 shadow-pink-400/20",
  "bg-gradient-to-bl from-sky-900/60 via-blue-900/40 to-cyan-900/60 backdrop-blur-xl border border-sky-400/30 shadow-sky-400/20",
  "bg-gradient-to-t from-gray-900/60 via-zinc-900/40 to-black/60 backdrop-blur-xl border border-gray-400/30 shadow-gray-400/20",
  "bg-gradient-to-br from-teal-900/60 via-cyan-900/40 to-blue-900/60 backdrop-blur-xl border border-teal-400/30 shadow-teal-400/20",
] as const;

export function GlassCard({ children, theme, className = "", onClick }: GlassCardProps) {
  const themeIndex = theme % THEMES.length;
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={`
        relative rounded-2xl overflow-hidden cursor-pointer
        ${THEMES[themeIndex]}
        shadow-2xl transition-all duration-500
        before:absolute before:inset-0 before:bg-white/5 before:rounded-2xl before:z-0
        ${className}
      `}
      style={{
        backgroundImage: `
          radial-gradient(circle at 10% 90%, rgba(255,255,255,0.1) 0%, transparent 50%),
          radial-gradient(circle at 90% 10%, rgba(255,255,255,0.1) 0%, transparent 50%)
        `,
      }}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}