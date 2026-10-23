/** 匯出時使用的字型（以 <img> 繪製 SVG 時不會套用頁面的 CSS） */
const EXPORT_FONT = "system-ui, 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('無法將畫布轉成圖片'));
    image.src = url;
  });
}

/** 把畫布 SVG 轉成 PNG。SVG 的顏色都寫在屬性上，所以不需要額外內嵌樣式。 */
export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const { width, height } = svg.viewBox.baseVal;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width * scale));
  clone.setAttribute('height', String(height * scale));
  clone.setAttribute('font-family', EXPORT_FONT);
  // 編輯用的控制點不需要出現在圖片中
  clone.querySelectorAll('[data-endpoint]').forEach((node) => node.remove());

  const source = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('瀏覽器不支援 canvas');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('PNG 編碼失敗'))),
        'image/png',
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // 讓瀏覽器有時間開始下載後再釋放
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
