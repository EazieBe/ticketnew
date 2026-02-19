export function formatAuditFieldLabel(field) {
  const key = String(field || '').trim();
  const labels = {
    workflow_state: 'Workflow State Changed',
    return_received: 'Expected Return Marked Received',
    status: 'Ticket Status Changed',
    check_in_time: 'Tech Checked In',
    check_out_time: 'Tech Checked Out',
    claimed_by: 'Ticket Claimed',
    follow_up_required: 'Return Follow-up Required',
    parts_received: 'Parts/Return Received',
  };
  if (labels[key]) return labels[key];
  if (!key) return 'Ticket Updated';
  return key
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatAuditValue(value) {
  if (value == null || value === '') return '';
  const normalized = String(value).trim();
  if (!normalized) return '';
  return normalized
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
