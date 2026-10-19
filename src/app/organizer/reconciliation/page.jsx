import { MpesaReconciliationPanel } from '@/components/payments/MpesaReconciliationPanel';

export default function OrganizerReconciliationPage() {
  return (
    <MpesaReconciliationPanel
      title="Payment Recovery Tracker"
      subtitle="Monitor your event payments after outages, including pending callbacks, failed checkouts, and confirmed recoveries."
      emptyMessage="No organizer payment records found for the selected filters."
    />
  );
}
