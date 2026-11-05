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
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (isoMatch) return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  const displayMatch = /^(\d{2})[/-](\d{2})[/-](\d{4})/.exec(value.trim());
  if (displayMatch) return `${displayMatch[1]}-${displayMatch[2]}-${displayMatch[3]}`;
  return value;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('day')}-${part('month')}-${part('year')} ${part('hour')}:${part('minute')}`;
}

export function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function displayDateToIso(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

export function formatLocalDateTimeInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]} ${match[4]}:${match[5]}` : value;
}

export function displayDateTimeToLocalIso(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}` : value;
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

export function firstDayOfJuneIso() {
  return `${todayIso().slice(0, 4)}-06-01`;
}

