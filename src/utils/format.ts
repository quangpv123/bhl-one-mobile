export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2) {
  return Number(value ?? 0).toLocaleString('vi-VN', { maximumFractionDigits });
}

export function formatMoney(value: number | null | undefined) {
  return `${formatNumber(value, 0)} ₫`;
}

export function formatWeight(value: number | null | undefined) {
  return `${formatNumber(value, 3)} kg`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const parts = value.slice(0, 10).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return value;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function firstDayOfMonthIso() {
  const today = todayIso();
  return `${today.slice(0, 8)}01`;
}

