// Tiện ích xử lý NGÀY TRÊN HÓA ĐƠN (trường `date`), không phải ngày upload.

/** Parse chuỗi ngày trên hóa đơn → Date (00:00 local) hoặc null */
export function parseInvoiceDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let d, m, y;

  // yyyy-mm-dd hoặc yyyy/mm/dd
  let mt = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (mt) {
    [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  } else {
    // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yy
    mt = s.match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/);
    if (mt) {
      [d, m, y] = [+mt[1], +mt[2], +mt[3]];
    } else {
      // "Ngày 26 tháng 10 năm 2025"
      mt = s.match(/(\d{1,2})\D+?(\d{1,2})\D+?(\d{4})/);
      if (!mt) return null;
      [d, m, y] = [+mt[1], +mt[2], +mt[3]];
    }
  }
  if (y < 100) y += 2000;
  if (m > 12 && d <= 12) [d, m] = [m, d]; // phòng trường hợp mm/dd
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

export const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
export const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);

/** Thứ Hai đầu tuần */
export function startOfWeek(dt) {
  const d = startOfDay(dt);
  const dow = (d.getDay() + 6) % 7; // T2 = 0
  return addDays(d, -dow);
}

/** Trả về {start, end} (end là mốc loại trừ) cho kỳ 'day' | 'week' | 'month' | 'year' chứa anchor */
export function getPeriodRange(period, anchor) {
  const a = startOfDay(anchor);
  switch (period) {
    case 'day':
      return { start: a, end: addDays(a, 1) };
    case 'week': {
      const s = startOfWeek(a);
      return { start: s, end: addDays(s, 7) };
    }
    case 'year':
      return { start: new Date(a.getFullYear(), 0, 1), end: new Date(a.getFullYear() + 1, 0, 1) };
    case 'month':
    default:
      return { start: new Date(a.getFullYear(), a.getMonth(), 1), end: new Date(a.getFullYear(), a.getMonth() + 1, 1) };
  }
}

/** Dịch anchor sang kỳ trước/sau */
export function shiftAnchor(period, anchor, step) {
  const a = new Date(anchor);
  if (period === 'day') return addDays(a, step);
  if (period === 'week') return addDays(a, step * 7);
  if (period === 'year') return new Date(a.getFullYear() + step, a.getMonth(), 1);
  return new Date(a.getFullYear(), a.getMonth() + step, 1);
}

export const fmtDate = (dt) =>
  dt ? `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}` : '';

export const toInputDate = (dt) =>
  dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` : '';

export const fmtVND = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n) || 0);
