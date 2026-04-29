/**
 * Mini bar chart em SVG puro — sem dependências.
 * Uso: <BarChart data={[{label:'Seg', value:12}, ...]} />
 */
interface Datum {
  label: string;
  value: number;
}

interface Props {
  data: Datum[];
  height?: number;
  /** Cor da barra (Tailwind). */
  barColor?: string;
}

export function BarChart({ data, height = 160, barColor = 'fill-brand-500' }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-slate-400">
        Sem dados.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;
  const innerH = 80; // 0..80 (deixa 20% para labels)

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = i * barWidth + barWidth * 0.15;
          const w = barWidth * 0.7;
          const y = innerH - h;
          return (
            <g key={d.label + i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={Math.max(h, 0.5)}
                rx="0.6"
                className={barColor}
              />
              <text
                x={x + w / 2}
                y={y - 1}
                textAnchor="middle"
                className="fill-slate-700 text-[3.2px] font-semibold"
                style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 0.8 }}
              >
                {d.value > 0 ? d.value : ''}
              </text>
            </g>
          );
        })}
        {/* Labels do eixo X */}
        {data.map((d, i) => (
          <text
            key={`l-${i}`}
            x={i * barWidth + barWidth / 2}
            y={innerH + 8}
            textAnchor="middle"
            className="fill-slate-400 text-[3.2px]"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
