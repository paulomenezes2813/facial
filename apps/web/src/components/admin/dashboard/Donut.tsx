/** Mini donut chart com 1 valor (ex: % check-in). SVG puro. */
interface Props {
  /** 0 a 100. */
  percent: number;
  label: string;
  size?: number;
  color?: string;
}

export function Donut({ percent, label, size = 120, color = '#5878ff' }: Props) {
  const p = Math.max(0, Math.min(100, percent));
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (p / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{Math.round(p)}%</span>
        </div>
      </div>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
