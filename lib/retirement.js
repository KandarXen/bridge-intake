export function retiredLostKeyMessage() {
  return 'This trial record was retired after a production encryption reset. The encrypted database payload is no longer recoverable by Bridge To AI. Please start a new interview.';
}

export function isRetiredLostKeyRecord(record) {
  return !!record && (
    record.retired_lost_key === true ||
    String(record.status || '').toLowerCase() === 'retired_lost_key'
  );
}

export function isLostKeyDecryptError(err) {
  const message = String(err?.message || '');
  return /authenticate data|bad decrypt|Unsupported state|Could not decrypt|Unsupported encrypted payload/i.test(message);
}

export function retiredLostKeyError() {
  const err = new Error(retiredLostKeyMessage());
  err.statusCode = 410;
  err.retiredLostKey = true;
  return err;
}
