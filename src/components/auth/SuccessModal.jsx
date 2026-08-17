import { CheckCircle2, ArrowRight } from 'lucide-react';
import GoldButton from './GoldButton';

export default function SuccessModal({ title, message, actionLabel = 'Continue', onAction }) {
  return (
    <div
      className="nf-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nf-success-title"
    >
      <div className="nf-success-modal">
        <div className="nf-success-icon">
          <CheckCircle2 aria-hidden="true" />
        </div>
        <h3 id="nf-success-title">{title}</h3>
        <p>{message}</p>
        <GoldButton onClick={onAction}>
          {actionLabel}
          <ArrowRight size={18} aria-hidden="true" />
        </GoldButton>
      </div>
    </div>
  );
}
