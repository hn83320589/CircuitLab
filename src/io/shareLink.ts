import type { Circuit } from '../model/types';
import { parseCircuit, serializeCircuit, type ParseResult } from './serialize';

/** 網址 hash 中存放電路的參數名稱：#c=… */
export const SHARE_PARAM = 'c';

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const output = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** 電路 → 壓縮後的 base64url 字串（使用瀏覽器原生 CompressionStream） */
export async function encodeShareFragment(circuit: Circuit): Promise<string> {
  const json = new TextEncoder().encode(serializeCircuit(circuit));
  return toBase64Url(await transform(json, new CompressionStream('deflate-raw')));
}

export async function decodeShareFragment(fragment: string): Promise<ParseResult> {
  let text: string;
  try {
    const bytes = await transform(fromBase64Url(fragment), new DecompressionStream('deflate-raw'));
    text = new TextDecoder().decode(bytes);
  } catch {
    return { ok: false, error: '分享連結已損壞，無法讀取電路。' };
  }
  return parseCircuit(text);
}

/** 從 location.hash 取出電路參數；沒有時回傳 null */
export function readShareFragment(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get(SHARE_PARAM);
}

export async function buildShareUrl(circuit: Circuit, base: string): Promise<string> {
  return `${base}#${SHARE_PARAM}=${await encodeShareFragment(circuit)}`;
}
