export interface ToastMessage {
  readonly text: string;
  readonly kind: 'info' | 'error';
  /** 剪貼簿無法使用時，讓使用者自行複製 */
  readonly link?: string;
}

export function Toast({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  return (
    <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
      <span>{toast.text}</span>
      {toast.link && (
        <input
          readOnly
          value={toast.link}
          onFocus={(e) => e.target.select()}
          aria-label="分享連結"
        />
      )}
      <button type="button" className="close" onClick={onClose} aria-label="關閉">
        ×
      </button>
    </div>
  );
}
