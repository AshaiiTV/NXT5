// A write is only "uncertain" when the server may have applied it: no HTTP
// status (network failure, abort, timeout), a 2xx without the expected
// result, a 408 or a 5xx. A 4xx refusal is definite: nothing was written, so
// the editor stays open and the administrator may correct it and retry.
export function isUncertainFailure(error) {
  const status = Number(error?.status);
  if (!Number.isInteger(status)) return true;
  return !(status >= 400 && status < 500) || status === 408;
}
