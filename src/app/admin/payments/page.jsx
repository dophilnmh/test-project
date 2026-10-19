import { MpesaReconciliationPanel } from '@/components/payments/MpesaReconciliationPanel';

export default function AdminPaymentsReconciliationPage() {
  return (
    <MpesaReconciliationPanel
      title="M-Pesa Reconciliation"
      subtitle="Track pending, failed, and recovered payments across ticketing and voting when callbacks are delayed or systems go down."
      emptyMessage="No M-Pesa records found for the selected filters."
    />
  );
}
