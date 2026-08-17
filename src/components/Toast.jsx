import { CheckCircle2, Trash2, AlertTriangle, Info, X } from 'lucide-react';
import { useNotes } from '../store';

const ICONS = { success: CheckCircle2, danger: Trash2, warning: AlertTriangle, info: Info };

function toastType(msg) {
  if (/deleted|delete|removed|remove/i.test(msg)) return 'danger';
  if (/could not|error|failed/i.test(msg)) return 'warning';
  if (/saved|created|added|updated|synced|installed|downloaded|restored|duplicated|pinned|unpinned|sent/i.test(msg)) {
    return 'success';
  }
  return 'info';
}

export default function Toast() {
  const { state, actions } = useNotes();
  const toast = state.toast;
  if (!toast) return null;

  const type = toastType(toast.msg);
  const Icon = ICONS[type];

  return (
    <div className={`toast show toast-${type}`} role="status" aria-live="polite">
      <div className="toast-icon">
        <Icon aria-hidden="true" />
      </div>
      <div className="toast-body">
        {toast.title && <p className="toast-title">{toast.title}</p>}
        <p className="toast-msg">{toast.msg}</p>
      </div>
      <button className="toast-close" onClick={() => actions.dismissToast(toast.id)} aria-label="Dismiss notification">
        <X size={15} aria-hidden="true" />
      </button>
      <span className="toast-progress" style={{ '--toast-duration': '4200ms' }} aria-hidden="true" />
    </div>
  );
}
