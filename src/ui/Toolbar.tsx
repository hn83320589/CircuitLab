import { TOOLS, type Tool } from './tools';

interface ToolbarProps {
  tool: Tool;
  onChange: (tool: Tool) => void;
}

export function Toolbar({ tool, onChange }: ToolbarProps) {
  return (
    <nav className="toolbar" aria-label="工具">
      {TOOLS.map(({ tool: t, label, hint }, i) => (
        <button
          key={t}
          type="button"
          className={t === tool ? 'tool active' : 'tool'}
          aria-pressed={t === tool}
          title={`${hint}（快速鍵 ${i + 1}）`}
          onClick={() => onChange(t)}
          data-tool={t}
        >
          <ToolIcon tool={t} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function ToolIcon({ tool }: { tool: Tool }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
  let body;
  switch (tool) {
    case 'select':
      body = <path d="M8 4 L8 20 L12 16 L15 22 L17 21 L14 15 L20 15 Z" {...common} />;
      break;
    case 'battery':
      body = (
        <>
          <path d="M2 12 H10 M14 12 H22" {...common} />
          <path d="M10 8 V16" {...common} strokeWidth={4} />
          <path d="M14 4 V20" {...common} />
        </>
      );
      break;
    case 'resistor':
      body = <polyline points="2,12 6,12 8,7 11,17 14,7 17,17 19,12 22,12" {...common} />;
      break;
    case 'bulb':
      body = (
        <>
          <circle cx={12} cy={12} r={7} {...common} />
          <path d="M7 7 L17 17 M17 7 L7 17" {...common} strokeWidth={1.5} />
        </>
      );
      break;
    case 'switch':
      body = (
        <>
          <path d="M2 14 H7 M17 14 H22 M7 14 L16 7" {...common} />
          <circle cx={7} cy={14} r={1.5} fill="currentColor" />
          <circle cx={17} cy={14} r={1.5} fill="currentColor" />
        </>
      );
      break;
    case 'wire':
      body = <path d="M3 19 L21 5" {...common} />;
      break;
    case 'ammeter':
    case 'voltmeter':
      body = (
        <>
          <circle cx={12} cy={12} r={8} {...common} />
          <text
            x={12}
            y={16}
            fontSize={10}
            fontWeight={700}
            textAnchor="middle"
            fill="currentColor"
          >
            {tool === 'ammeter' ? 'A' : 'V'}
          </text>
        </>
      );
      break;
  }
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
      {body}
    </svg>
  );
}
