export function movementFieldVisibility(type, adjustmentDirection = 'increase') {
  const isIssue = type === 'issue';
  const isTransfer = type === 'transfer';
  const isAdjustment = type === 'adjustment';

  return {
    reason: isIssue,
    adjustment: isAdjustment,
    from: isIssue || isTransfer || isAdjustment,
    to: type === 'receipt' || isTransfer || (isAdjustment && adjustmentDirection === 'increase'),
  };
}
