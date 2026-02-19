import { formatAuditFieldLabel, formatAuditValue } from './utils/auditFormatters';

describe('CompactTicketDetail audit formatters', () => {
  test('formats known audit fields with friendly labels', () => {
    expect(formatAuditFieldLabel('workflow_state')).toBe('Workflow State Changed');
    expect(formatAuditFieldLabel('return_received')).toBe('Expected Return Marked Received');
  });

  test('formats unknown field names and values cleanly', () => {
    expect(formatAuditFieldLabel('nro_phase2_scheduled')).toBe('Nro Phase2 Scheduled');
    expect(formatAuditValue('nro_ready_for_completion')).toBe('Nro Ready For Completion');
  });
});
