import type { ElementKind } from '../model/types';

export type Tool = 'select' | ElementKind;

export const TOOLS: readonly { tool: Tool; label: string; hint: string }[] = [
  { tool: 'select', label: '選取', hint: '點選、拖曳元件；點開關可切換' },
  { tool: 'battery', label: '電池', hint: '點畫布放置' },
  { tool: 'resistor', label: '電阻', hint: '點畫布放置' },
  { tool: 'bulb', label: '燈泡', hint: '點畫布放置' },
  { tool: 'switch', label: '開關', hint: '點畫布放置' },
  { tool: 'wire', label: '導線', hint: '從一個格點拖到另一個格點' },
  { tool: 'ammeter', label: '電流計', hint: '點畫布放置' },
  { tool: 'voltmeter', label: '電壓計', hint: '點畫布放置' },
];
