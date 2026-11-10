import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadInvoice, updateInvoice, deleteInvoice } from '../services/api';
import {
  UploadCloud,
  Image as ImageIcon,
  FileText,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
  RotateCcw,
  RotateCw,
  Crop,
  Eye,
  Cpu,
  Check,
  Store,
  Receipt,
  ListChecks,
  ShieldCheck,
  Layers,
  X,
} from 'lucide-react';

const SCAN_DRAFT_STORAGE_KEY = 'invoice_ai_scan_draft_v2';
const MULTI_INVOICE_MARKER = 'Chỉ được quét 1 hóa đơn';
const DEFAULT_CROP_RECT = { top: 4, bottom: 4, left: 4, right: 4 };
const MIN_CROP_SPAN = 10; // % tối thiểu của vùng cắt

// ===== Tiện ích xử lý ảnh (Cắt viền / Xoay) bằng HTML5 Canvas =====
function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function dataUrlToFile(dataUrl, fileName) {
  const [header, base64] = String(dataUrl).split(',');
  const mime = (header.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

// ===== Tách / ghép trường thông tin tài liệu "Tên trường: Nội dung" =====
function splitFieldText(text) {
  const raw = String(text || '');
  const idx = raw.indexOf(':');
  if (idx > 0 && idx <= 80) {
    return { key: raw.slice(0, idx).trim(), val: raw.slice(idx + 1).trim() };
  }
  return { key: '', val: raw.trim() };
}

function composeFieldText(key, val) {
  const k = String(key || '').trim();
  const v = String(val || '').trim();
  if (k && v) return `${k}: ${v}`;
  if (k) return `${k}:`;
  return v;
}

function getFieldParts(item) {
  if (item && item.field_key !== undefined) {
    return { key: item.field_key || '', val: item.field_value || '' };
  }
  return splitFieldText(item?.name || item?.item_name || '');
}

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function inferVatFromRawText(rawText, totalAmount, itemsSum, storeName = '') {
  const total = Math.round(Number(totalAmount) || 0);
  if (total <= 0) return 0;
  const lower = String(rawText || '').toLowerCase();
  const storeLower = String(storeName || '').toLowerCase();
  const hasVatKeyword =
    lower.includes('vat') ||
    lower.includes('gtgt') ||
    lower.includes('thuế') ||
    lower.includes('thue') ||
    storeLower.includes('aeon');
  if (!hasVatKeyword) return 0;

  const rateMatches = [...lower.matchAll(/(?:vat|gtgt|thuế|thue)?\s*(5|8|10)\s*%/gi)];
  let dominantRate = 0;
  if (rateMatches.length > 0) {
    const freq = {};
    rateMatches.forEach((m) => {
      const r = Number(m[1]);
      freq[r] = (freq[r] || 0) + 1;
    });
    dominantRate = Number(
      Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0]
    );
  } else if (
    lower.includes('đã bao gồm thuế') ||
    lower.includes('da bao gom thue') ||
    storeLower.includes('aeon')
  ) {
    dominantRate = 8;
  }
  if (!dominantRate) return 0;

  return Math.round((total * dominantRate) / (100 + dominantRate));
}

// Bộ nhớ đệm cấp module (giữ sống tiến trình quét kể cả khi user chuyển sang tab khác)
const scanRuntimeStore = {
  loading: false,
  fileMeta: null, // { name, size }
  preview: null,
  extractedInvoice: null,
  formData: null,
  multiBills: [], // Danh sách hóa đơn khi phát hiện > 1 bill
  showMultiModal: false,
  duplicateAlert: null,
  error: '',
  listeners: new Set(),
};

// Khôi phục từ sessionStorage nếu trình duyệt vừa reload
try {
  const rawSaved = sessionStorage.getItem(SCAN_DRAFT_STORAGE_KEY);
  if (rawSaved) {
    const parsed = JSON.parse(rawSaved);
    if (parsed && (parsed.extractedInvoice || parsed.preview || (parsed.multiBills && parsed.multiBills.length > 0))) {
      scanRuntimeStore.fileMeta = parsed.fileMeta || null;
      scanRuntimeStore.preview = parsed.preview || null;
      scanRuntimeStore.extractedInvoice = parsed.extractedInvoice || null;
      scanRuntimeStore.formData = parsed.formData || null;
      if (
        scanRuntimeStore.formData &&
        scanRuntimeStore.formData.invoice_type !== 'Document/Form' &&
        (Number(scanRuntimeStore.formData.tax_amount) || 0) <= 0 &&
        (Number(scanRuntimeStore.formData.total_amount) || 0) > 0
      ) {
        const savedItemsSum = Array.isArray(scanRuntimeStore.formData.items)
          ? scanRuntimeStore.formData.items.reduce((s, it) => s + (Number(it.total_price) || 0), 0)
          : 0;
        const inferredTax = inferVatFromRawText(
          scanRuntimeStore.extractedInvoice?.raw_text,
          scanRuntimeStore.formData.total_amount,
          savedItemsSum,
          scanRuntimeStore.formData.store_name || scanRuntimeStore.extractedInvoice?.store_name
        );
        if (inferredTax > 0) {
          scanRuntimeStore.formData.tax_amount = inferredTax;
          scanRuntimeStore.formData.subtotal = Math.max(
            0,
            Math.round(Number(scanRuntimeStore.formData.total_amount) - inferredTax)
          );
        }
      }
      scanRuntimeStore.multiBills = Array.isArray(parsed.multiBills) ? parsed.multiBills : [];
      scanRuntimeStore.showMultiModal = Boolean(parsed.showMultiModal);
    }
  }
} catch (e) {
  // Ignore sessionStorage parse error
}

function persistRuntimeToSession() {
  try {
    if (!scanRuntimeStore.extractedInvoice && !scanRuntimeStore.preview && scanRuntimeStore.multiBills.length === 0) {
      sessionStorage.removeItem(SCAN_DRAFT_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(
      SCAN_DRAFT_STORAGE_KEY,
      JSON.stringify({
        fileMeta: scanRuntimeStore.fileMeta,
        preview: scanRuntimeStore.preview,
        extractedInvoice: scanRuntimeStore.extractedInvoice,
        formData: scanRuntimeStore.formData,
        multiBills: scanRuntimeStore.multiBills,
        showMultiModal: scanRuntimeStore.showMultiModal,
      })
    );
  } catch (e) {
    // Ignore quota errors
  }
}

function notifyRuntimeListeners() {
  persistRuntimeToSession();
  scanRuntimeStore.listeners.forEach((fn) => fn({ ...scanRuntimeStore }));
}

function buildFormDataFromInvoice(data) {
  const invoiceType = data?.invoice_type || 'Other';
  const isDocForm = invoiceType === 'Document/Form';
  const mappedItems = Array.isArray(data?.items)
    ? data.items.map((it) => {
        const itemName = it.item_name || it.name || '';
        const parts = splitFieldText(itemName);
        return {
          name: itemName,
          item_name: itemName,
          field_key: parts.key,
          field_value: parts.val,
          unit: it.unit || '',
          quantity: Number(it.quantity) || 1,
          unit_price: Math.round(Number(it.unit_price) || 0),
          total_price: Math.round(Number(it.total_price) || 0),
        };
      })
    : [];

  const totalAmount = isDocForm ? 0 : Math.round(Number(data?.total_amount) || 0);
  const itemsSum = mappedItems.reduce((acc, it) => acc + (Number(it.total_price) || 0), 0);
  let taxAmount = isDocForm ? 0 : Math.round(Number(data?.tax_amount) || 0);
  if (!isDocForm && taxAmount <= 0 && totalAmount > 0) {
    taxAmount = inferVatFromRawText(data?.raw_text, totalAmount, itemsSum, data?.store_name);
  }
  let subtotal = isDocForm ? 0 : Math.round(Number(data?.subtotal) || 0);
  if (!isDocForm && taxAmount > 0 && totalAmount > taxAmount && (subtotal <= 0 || subtotal === totalAmount)) {
    subtotal = Math.max(0, totalAmount - taxAmount);
  }

  return {
    store_name: data?.store_name || '',
    store_address: data?.store_address || '',
    date: data?.date || '',
    invoice_type: invoiceType,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    items: mappedItems,
  };
}

export default function Scan() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileMeta, setFileMeta] = useState(scanRuntimeStore.fileMeta);
  const [preview, setPreview] = useState(scanRuntimeStore.preview);
  const [loading, setLoading] = useState(scanRuntimeStore.loading);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(scanRuntimeStore.error);
  const [duplicateAlert, setDuplicateAlert] = useState(scanRuntimeStore.duplicateAlert);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState(null);
  const [zoomImage, setZoomImage] = useState(false);

  // Step 2: Extracted invoice state for user verification & editing
  const [extractedInvoice, setExtractedInvoice] = useState(scanRuntimeStore.extractedInvoice);
  const [formData, setFormData] = useState(
    scanRuntimeStore.formData || {
      store_name: '',
      store_address: '',
      date: '',
      invoice_type: 'Other',
      subtotal: 0,
      tax_amount: 0,
      total_amount: 0,
      items: [],
    }
  );

  // Multi-invoice state (> 1 hóa đơn)
  const [multiBills, setMultiBills] = useState(scanRuntimeStore.multiBills || []);
  const [selectedBillIds, setSelectedBillIds] = useState(() =>
    (scanRuntimeStore.multiBills || []).map((b) => b.invoice_id)
  );
  const [showMultiModal, setShowMultiModal] = useState(scanRuntimeStore.showMultiModal);
  const [activeBillIdx, setActiveBillIdx] = useState(0);

  // Confirmation modals for delete/reset actions
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmDeleteItemIdx, setConfirmDeleteItemIdx] = useState(null);
  const [selectedItemIndices, setSelectedItemIndices] = useState([]);
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);

  // Công cụ Cắt viền ảnh (Crop) & Xoay ảnh ở Bước 1
  const [cropMode, setCropMode] = useState(() =>
    String(scanRuntimeStore.error || '').includes(MULTI_INVOICE_MARKER)
  );
  const [cropRect, setCropRect] = useState(DEFAULT_CROP_RECT);
  const [dragCorner, setDragCorner] = useState(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const cropBoxRef = useRef(null);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Đồng bộ với scanRuntimeStore khi user chuyển qua tab khác rồi quay lại
  useEffect(() => {
    const handleSync = (snap) => {
      setLoading(snap.loading);
      setFileMeta(snap.fileMeta);
      setPreview(snap.preview);
      setExtractedInvoice(snap.extractedInvoice);
      if (snap.formData) setFormData(snap.formData);
      setMultiBills(snap.multiBills || []);
      setShowMultiModal(snap.showMultiModal);
      setDuplicateAlert(snap.duplicateAlert);
      setError(snap.error);
      if (Array.isArray(snap.multiBills) && snap.multiBills.length > 0) {
        setSelectedBillIds(snap.multiBills.map((b) => b.invoice_id));
      }
    };
    scanRuntimeStore.listeners.add(handleSync);
    return () => {
      scanRuntimeStore.listeners.delete(handleSync);
    };
  }, []);

  // Lưu tự động mỗi khi người dùng chỉnh sửa formData ở Bước 2
  useEffect(() => {
    if (extractedInvoice) {
      scanRuntimeStore.extractedInvoice = extractedInvoice;
      scanRuntimeStore.formData = formData;
      persistRuntimeToSession();
    }
  }, [extractedInvoice, formData]);

  const handleFilesSelect = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f && f.type.startsWith('image/'));
    if (files.length === 0) {
      setError('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WEBP, ...)');
      return;
    }
    setSelectedFiles(files);
    setCropMode(false);
    setCropRect(DEFAULT_CROP_RECT);
    const first = files[0];
    const meta = {
      name: files.length > 1 ? `${first.name} (+${files.length - 1} ảnh khác)` : first.name,
      size: files.reduce((acc, f) => acc + f.size, 0),
      count: files.length,
    };
    setFileMeta(meta);
    scanRuntimeStore.fileMeta = meta;
    setError('');
    scanRuntimeStore.error = '';
    setDuplicateAlert(null);
    scanRuntimeStore.duplicateAlert = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      scanRuntimeStore.preview = e.target.result;
      persistRuntimeToSession();
    };
    reader.readAsDataURL(first);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // ===== CẮT VIỀN ẢNH (CROP) & XOAY ẢNH =====
  // Kéo thả 4 góc khung cắt
  useEffect(() => {
    if (!dragCorner) return undefined;
    const onMove = (e) => {
      const rect = cropBoxRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
      setCropRect((prev) => {
        const next = { ...prev };
        if (dragCorner.includes('t')) next.top = Math.max(0, Math.min(y, 100 - prev.bottom - MIN_CROP_SPAN));
        if (dragCorner.includes('b')) next.bottom = Math.max(0, Math.min(100 - y, 100 - prev.top - MIN_CROP_SPAN));
        if (dragCorner.includes('l')) next.left = Math.max(0, Math.min(x, 100 - prev.right - MIN_CROP_SPAN));
        if (dragCorner.includes('r')) next.right = Math.max(0, Math.min(100 - x, 100 - prev.left - MIN_CROP_SPAN));
        return next;
      });
    };
    const onUp = () => setDragCorner(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragCorner]);

  const handleCropSlider = (side, value) => {
    const v = Number(value) || 0;
    setCropRect((prev) => {
      const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side];
      return { ...prev, [side]: Math.max(0, Math.min(v, 100 - prev[opposite] - MIN_CROP_SPAN)) };
    });
  };

  // Thay ảnh chính đang chọn bằng ảnh mới (đã cắt / đã xoay)
  const replacePrimaryImage = (dataUrl, label) => {
    const rawName = selectedFiles[0]?.name || fileMeta?.name || 'chung_tu.jpg';
    const baseName = rawName
      .replace(/\s*\(\+\d+ ảnh khác\)$/, '')
      .replace(/\.[^.]+$/, '')
      .replace(/(_(cropped|rotated))+$/, '');
    const newFile = dataUrlToFile(dataUrl, `${baseName}_${label}.jpg`);
    const nextFiles = selectedFiles.length > 0 ? [newFile, ...selectedFiles.slice(1)] : [newFile];
    setSelectedFiles(nextFiles);

    setPreview(dataUrl);
    scanRuntimeStore.preview = dataUrl;
    const meta = {
      name: nextFiles.length > 1 ? `${newFile.name} (+${nextFiles.length - 1} ảnh khác)` : newFile.name,
      size: nextFiles.reduce((acc, f) => acc + f.size, 0),
      count: nextFiles.length,
    };
    setFileMeta(meta);
    scanRuntimeStore.fileMeta = meta;
    persistRuntimeToSession();
  };

  const handleRotatePreview = async () => {
    if (!preview || imageProcessing) return;
    setImageProcessing(true);
    try {
      const img = await loadImageElement(preview);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0);
      replacePrimaryImage(canvas.toDataURL('image/jpeg', 0.95), 'rotated');
      setCropRect(DEFAULT_CROP_RECT);
    } catch (e) {
      showToast('Không thể xoay ảnh. Vui lòng thử lại.', 'error');
    } finally {
      setImageProcessing(false);
    }
  };

  const handleApplyCrop = async () => {
    if (!preview || imageProcessing) return;
    setImageProcessing(true);
    try {
      const img = await loadImageElement(preview);
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const sx = Math.round((W * cropRect.left) / 100);
      const sy = Math.round((H * cropRect.top) / 100);
      const sw = Math.max(1, Math.round((W * (100 - cropRect.left - cropRect.right)) / 100));
      const sh = Math.max(1, Math.round((H * (100 - cropRect.top - cropRect.bottom)) / 100));
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      replacePrimaryImage(canvas.toDataURL('image/jpeg', 0.95), 'cropped');

      setCropMode(false);
      setCropRect(DEFAULT_CROP_RECT);
      setError('');
      scanRuntimeStore.error = '';
      showToast('Đã cắt viền ảnh! Bấm "Bắt đầu đọc & bóc tách" để quét.');
    } catch (e) {
      showToast('Không thể cắt ảnh. Vui lòng thử lại.', 'error');
    } finally {
      setImageProcessing(false);
    }
  };

  const handleCancelCrop = () => {
    setCropMode(false);
    setCropRect(DEFAULT_CROP_RECT);
  };

  // Step 1 -> Step 2: Upload & Run OCR (chạy nền an toàn kể cả khi user chuyển tab)
  const handleScan = async (forceOverwrite = false) => {
    if (selectedFiles.length === 0 && !preview) {
      setError('Vui lòng chọn ảnh hóa đơn trước khi đọc');
      return;
    }

    scanRuntimeStore.loading = true;
    scanRuntimeStore.error = '';
    setCropMode(false);
    if (!forceOverwrite) {
      scanRuntimeStore.duplicateAlert = null;
    }
    notifyRuntimeListeners();

    try {
      // Sau khi tải lại trang, selectedFiles có thể trống nhưng vẫn còn ảnh xem trước -> dựng lại File từ preview
      const filesToProcess =
        selectedFiles.length > 0
          ? selectedFiles
          : [dataUrlToFile(preview, (fileMeta?.name || 'chung_tu.jpg').replace(/\s*\(\+\d+ ảnh khác\)$/, ''))];
      const collectedBills = [];

      for (let i = 0; i < filesToProcess.length; i++) {
        const f = filesToProcess[i];
        const filePreviewUrl = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = (ev) => resolve(ev.target.result);
          r.readAsDataURL(f);
        });

        const res = await uploadInvoice(f, forceOverwrite);
        const data = res.data?.data || res.data;

        if (Array.isArray(data?.multiple_invoices) && data.multiple_invoices.length > 1) {
          data.multiple_invoices.forEach((subInv) => {
            collectedBills.push({
              ...subInv,
              _preview: filePreviewUrl,
              _fileName: f.name,
            });
          });
        } else if (data?.invoice_id) {
          collectedBills.push({
            ...data,
            _preview: filePreviewUrl,
            _fileName: f.name,
          });
        }
      }

      if (collectedBills.length > 0) {
        const primary = collectedBills[0];
        const initialForm = buildFormDataFromInvoice(primary);

        scanRuntimeStore.duplicateAlert = null;
        scanRuntimeStore.extractedInvoice = primary;
        scanRuntimeStore.formData = initialForm;
        scanRuntimeStore.preview = primary._preview || scanRuntimeStore.preview;

        if (collectedBills.length > 1) {
          scanRuntimeStore.multiBills = collectedBills;
          scanRuntimeStore.showMultiModal = true;
          setSelectedBillIds(collectedBills.map((b) => b.invoice_id));
          setActiveBillIdx(0);
          showToast(`Phát hiện ${collectedBills.length} hóa đơn! Vui lòng chọn hóa đơn muốn giữ.`);
        } else {
          scanRuntimeStore.multiBills = [];
          scanRuntimeStore.showMultiModal = false;
          showToast(
            forceOverwrite
              ? 'Đã quét đè hóa đơn thành công! Vui lòng kiểm tra thông tin.'
              : 'Đã đọc hóa đơn! Vui lòng kiểm tra và chỉnh sửa thông tin trước khi lưu.'
          );
        }
      } else {
        scanRuntimeStore.error = 'Đã xử lý nhưng không nhận được dữ liệu hóa đơn';
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 409 && detail && typeof detail === 'object') {
        scanRuntimeStore.duplicateAlert = {
          message: detail.message || 'Hóa đơn này đã tồn tại trong hệ thống.',
          existing_invoice_id: detail.existing_invoice_id,
          store_name: detail.store_name,
          date: detail.date,
          total_amount: detail.total_amount,
        };
      } else if (typeof detail === 'string' && detail.includes(MULTI_INVOICE_MARKER)) {
        // Ảnh chứa >= 2 hóa đơn -> chặn lại & tự động mở công cụ Cắt ảnh
        scanRuntimeStore.error = detail;
        setCropMode(true);
        setCropRect(DEFAULT_CROP_RECT);
        showToast('Phát hiện từ 2 hóa đơn trở lên trong ảnh! Hãy cắt lấy 1 hóa đơn rồi quét lại.', 'error');
      } else if (typeof detail === 'string' && detail.includes('đã tồn tại')) {
        const match = detail.match(/mã(?: hóa đơn)?:?\s*([A-Za-z0-9_]+)/i);
        scanRuntimeStore.duplicateAlert = {
          message: detail,
          existing_invoice_id: match ? match[1] : null,
        };
      } else {
        scanRuntimeStore.error =
          typeof detail === 'string'
            ? detail
            : 'Lỗi khi xử lý hóa đơn. Vui lòng thử lại.';
      }
    } finally {
      scanRuntimeStore.loading = false;
      notifyRuntimeListeners();
    }
  };

  // Kiểm tra xem có dòng mặt hàng / trường thông tin nào vừa thêm nhưng chưa điền thông tin hay không
  const validateIncompleteItems = () => {
    const isDocForm = formData.invoice_type === 'Document/Form';
    for (let i = 0; i < formData.items.length; i++) {
      const it = formData.items[i];
      const parts = getFieldParts(it);
      const nameStr = (it.name || it.item_name || '').trim();
      const uPrice = Number(it.unit_price) || 0;
      const tPrice = Number(it.total_price) || 0;
      if (isDocForm) {
        if (!parts.key.trim() && !parts.val.trim() && !nameStr) {
          const msg = `Trường thông tin số ${i + 1} chưa nhập nội dung. Vui lòng điền thông tin hoặc xóa dòng trống!`;
          setError(msg);
          showToast(msg, 'error');
          return false;
        }
      } else {
        if (!nameStr) {
          const msg = `Dòng sản phẩm số ${i + 1} chưa nhập "Tên mặt hàng". Vui lòng điền thông tin hoặc xóa dòng trống trước khi thao tác tiếp!`;
          setError(msg);
          showToast(msg, 'error');
          return false;
        }
        if (uPrice <= 0 && tPrice <= 0) {
          const msg = `Mặt hàng "${nameStr}" (dòng ${i + 1}) chưa có Đơn giá / Thành tiền. Vui lòng nhập giá tiền!`;
          setError(msg);
          showToast(msg, 'error');
          return false;
        }
      }
    }
    setError('');
    return true;
  };

  // Handlers for editing form fields
  const handleFieldChange = (field, value) => {
    setFormData((prev) => {
      if (field === 'invoice_type' && value === 'Document/Form') {
        return {
          ...prev,
          invoice_type: value,
          subtotal: 0,
          tax_amount: 0,
          total_amount: 0,
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleDocItemChange = (index, part, value) => {
    setFormData((prev) => {
      const updatedItems = [...prev.items];
      const cur = { ...updatedItems[index] };
      const parts = getFieldParts(cur);
      const newKey = part === 'key' ? value : parts.key;
      const newVal = part === 'val' ? value : parts.val;
      const combined = composeFieldText(newKey, newVal);
      updatedItems[index] = {
        ...cur,
        field_key: newKey,
        field_value: newVal,
        name: combined,
        item_name: combined,
      };
      return { ...prev, items: updatedItems };
    });
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedItems = [...prev.items];
      const current = { ...updatedItems[index], [field]: value };

      if (field === 'name') {
        current.item_name = value;
      }

      if (field === 'quantity' || field === 'unit_price') {
        const q = Number(field === 'quantity' ? value : current.quantity) || 0;
        const p = Number(field === 'unit_price' ? value : current.unit_price) || 0;
        if (q > 0 && p >= 0) {
          current.total_price = Math.round(q * p);
        }
      }

      updatedItems[index] = current;
      return { ...prev, items: updatedItems };
    });
  };

  const handleAddItem = () => {
    if (!validateIncompleteItems()) return;
    const isDocForm = formData.invoice_type === 'Document/Form';
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          name: '',
          item_name: '',
          field_key: isDocForm ? `Trường ${prev.items.length + 1}` : '',
          field_value: '',
          unit: isDocForm ? '' : 'Cái',
          quantity: 1,
          unit_price: 0,
          total_price: 0,
        },
      ],
    }));
  };

  const confirmRemoveItem = (index) => {
    setConfirmDeleteItemIdx(index);
  };

  const executeRemoveItem = () => {
    if (confirmDeleteItemIdx === null) return;
    const idxToRemove = confirmDeleteItemIdx;
    setConfirmDeleteItemIdx(null);
    setSelectedItemIndices((prev) =>
      prev.filter((i) => i !== idxToRemove).map((i) => (i > idxToRemove ? i - 1 : i))
    );
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== idxToRemove),
    }));
    showToast(
      formData.invoice_type === 'Document/Form'
        ? 'Đã xóa trường thông tin.'
        : 'Đã xóa dòng sản phẩm.'
    );
  };

  const handleToggleSelectItem = (idx) => {
    setSelectedItemIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleToggleSelectAllItems = () => {
    if (selectedItemIndices.length === formData.items.length && formData.items.length > 0) {
      setSelectedItemIndices([]);
    } else {
      setSelectedItemIndices(formData.items.map((_, idx) => idx));
    }
  };

  const executeBulkRemoveItems = () => {
    if (selectedItemIndices.length === 0) return;
    const removedCount = selectedItemIndices.length;
    setConfirmBulkDeleteOpen(false);
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => !selectedItemIndices.includes(idx)),
    }));
    setSelectedItemIndices([]);
    showToast(
      formData.invoice_type === 'Document/Form'
        ? `Đã xóa ${removedCount} trường thông tin đã chọn.`
        : `Đã xóa ${removedCount} dòng sản phẩm đã chọn.`
    );
  };

  // Tính lại tổng tiền chính xác từ các dòng mặt hàng (tự động xử lý cả HĐ đã gồm VAT và chưa gồm VAT)
  const handleRecalculateTotal = () => {
    if (!validateIncompleteItems()) return;

    const syncedItems = formData.items.map((it) => {
      const q = Number(it.quantity) || 1;
      const p = Number(it.unit_price) || 0;
      const rowTotal = q > 0 && p > 0 ? Math.round(q * p) : Math.round(Number(it.total_price) || 0);
      const rowUnit = p > 0 ? Math.round(p) : q > 0 ? Math.round(rowTotal / q) : 0;
      return {
        ...it,
        quantity: q,
        unit_price: rowUnit,
        total_price: rowTotal,
      };
    });

    const itemsSum = syncedItems.reduce((acc, it) => acc + (Number(it.total_price) || 0), 0);
    const currentTax = Math.round(Number(formData.tax_amount) || 0);

    // Kiểm tra xem hóa đơn gốc có phải loại giá mặt hàng đã bao gồm VAT hay không
    const origItemsSum = Array.isArray(extractedInvoice?.items)
      ? extractedInvoice.items.reduce((s, i) => s + (Number(i.total_price) || 0), 0)
      : 0;
    const origTotal = Number(extractedInvoice?.total_amount) || 0;
    const origTax = Number(extractedInvoice?.tax_amount) || 0;

    const isVatInclusive =
      origItemsSum > 0 &&
      origTax > 0 &&
      Math.abs(origItemsSum - origTotal) <= Math.max(10, origTax * 0.1);

    let nextSubtotal = itemsSum;
    let nextTotal = itemsSum;

    if (isVatInclusive) {
      // Giá từng mặt hàng trên hóa đơn siêu thị đã bao gồm thuế GTGT
      nextTotal = Math.round(itemsSum);
      nextSubtotal = Math.max(0, Math.round(itemsSum - currentTax));
    } else {
      // Thuế GTGT cộng thêm vào tạm tính
      nextSubtotal = Math.round(itemsSum);
      nextTotal = Math.round(itemsSum + currentTax);
    }

    setFormData((prev) => ({
      ...prev,
      items: syncedItems,
      subtotal: nextSubtotal,
      tax_amount: currentTax,
      total_amount: nextTotal,
    }));

    showToast(
      `Đã tính lại chuẩn xác: Tổng thanh toán ${nextTotal.toLocaleString('vi-VN')} đ!`
    );
  };

  // Xử lý lựa chọn giữ hóa đơn nào hoặc giữ tất cả khi quét > 1 hóa đơn
  const handleToggleSelectBill = (id) => {
    setSelectedBillIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleKeepSelectedBills = async (keepAll = false) => {
    const idsToKeep = keepAll ? multiBills.map((b) => b.invoice_id) : selectedBillIds;
    if (idsToKeep.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 hóa đơn để giữ lại!', 'error');
      return;
    }

    const billsToDelete = multiBills.filter((b) => !idsToKeep.includes(b.invoice_id));
    const billsToKeep = multiBills.filter((b) => idsToKeep.includes(b.invoice_id));

    for (const delBill of billsToDelete) {
      try {
        await deleteInvoice(delBill.invoice_id, 'Người dùng bỏ chọn khi quét nhiều hóa đơn');
      } catch (e) {
        // Ignore cleanup error
      }
    }

    const firstKeep = billsToKeep[0];
    const nextForm = buildFormDataFromInvoice(firstKeep);

    scanRuntimeStore.multiBills = billsToKeep.length > 1 ? billsToKeep : [];
    scanRuntimeStore.showMultiModal = false;
    scanRuntimeStore.extractedInvoice = firstKeep;
    scanRuntimeStore.formData = nextForm;
    scanRuntimeStore.preview = firstKeep._preview || scanRuntimeStore.preview;
    setActiveBillIdx(0);
    notifyRuntimeListeners();

    showToast(
      billsToKeep.length > 1
        ? `Đã giữ lại ${billsToKeep.length} hóa đơn! Bạn có thể kiểm tra từng hóa đơn hoặc lưu tất cả.`
        : 'Đã giữ lại 1 hóa đơn để bạn kiểm duyệt!'
    );
  };

  const handleSwitchActiveBill = (idx) => {
    if (!multiBills[idx]) return;
    // Lưu lại thay đổi hiện tại vào multiBills trước khi chuyển
    const updatedBills = [...multiBills];
    if (updatedBills[activeBillIdx]) {
      updatedBills[activeBillIdx] = {
        ...updatedBills[activeBillIdx],
        ...formData,
      };
    }
    const targetBill = updatedBills[idx];
    const nextForm = buildFormDataFromInvoice(targetBill);

    setActiveBillIdx(idx);
    scanRuntimeStore.multiBills = updatedBills;
    scanRuntimeStore.extractedInvoice = targetBill;
    scanRuntimeStore.formData = nextForm;
    if (targetBill._preview) {
      scanRuntimeStore.preview = targetBill._preview;
    }
    notifyRuntimeListeners();
  };

  // Step 2 -> Final: Submit confirmed & edited invoice(s)
  const handleConfirmSubmit = async (e) => {
    e.preventDefault();
    if (!extractedInvoice?.invoice_id) return;
    if (!validateIncompleteItems()) return;

    setSubmitting(true);
    setError('');

    try {
      const cleanTotal = Math.round(Number(formData.total_amount) || 0);
      const cleanTax = Math.round(Number(formData.tax_amount) || 0);
      const cleanSubtotal = Math.max(0, Math.round(cleanTotal - cleanTax));

      const payload = {
        invoice_id: extractedInvoice.invoice_id,
        store_name: formData.store_name.trim() || 'Cửa hàng chưa xác định',
        store_address: formData.store_address.trim(),
        date: formData.date.trim(),
        invoice_type: formData.invoice_type,
        subtotal: cleanSubtotal,
        tax_amount: cleanTax,
        total_amount: cleanTotal,
        items: formData.items
          .filter((it) => {
            const parts = getFieldParts(it);
            return (
              parts.key.trim() !== '' ||
              parts.val.trim() !== '' ||
              (it.name || it.item_name || '').trim() !== ''
            );
          })
          .map((it) => {
            const parts = getFieldParts(it);
            const cleanName =
              formData.invoice_type === 'Document/Form'
                ? composeFieldText(parts.key, parts.val)
                : (it.name || it.item_name || '').trim();
            return {
              name: cleanName,
              item_name: cleanName,
              unit: (it.unit || '').trim(),
              quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
              unit_price: Math.round(Number(it.unit_price) || 0),
              total_price: Math.round(Number(it.total_price) || 0),
            };
          }),
        raw_text: extractedInvoice.raw_text || '',
        image_path: extractedInvoice.image_path || '',
        is_submitted: true,
      };

      await updateInvoice(extractedInvoice.invoice_id, payload);

      // Nếu đang giữ nhiều hóa đơn và người dùng lưu hóa đơn hiện tại
      if (multiBills.length > 1) {
        const remaining = multiBills.filter((b) => b.invoice_id !== extractedInvoice.invoice_id);
        if (remaining.length > 0) {
          const nextBill = remaining[0];
          const nextForm = buildFormDataFromInvoice(nextBill);
          scanRuntimeStore.multiBills = remaining;
          scanRuntimeStore.extractedInvoice = nextBill;
          scanRuntimeStore.formData = nextForm;
          if (nextBill._preview) scanRuntimeStore.preview = nextBill._preview;
          setActiveBillIdx(0);
          setSubmitting(false);
          notifyRuntimeListeners();
          showToast(`Đã lưu hóa đơn! Chuyển sang hóa đơn tiếp theo (còn ${remaining.length} HĐ).`);
          return;
        }
      }

      // Xóa bộ nhớ tạm sau khi đã lưu hoàn tất
      const savedId = extractedInvoice.invoice_id;
      scanRuntimeStore.extractedInvoice = null;
      scanRuntimeStore.formData = null;
      scanRuntimeStore.preview = null;
      scanRuntimeStore.fileMeta = null;
      scanRuntimeStore.multiBills = [];
      scanRuntimeStore.showMultiModal = false;
      notifyRuntimeListeners();

      showToast(
        formData.invoice_type === 'Document/Form'
          ? 'Đã xác nhận và lưu tài liệu thành công!'
          : 'Đã xác nhận và lưu hóa đơn thành công!'
      );
      setTimeout(() => {
        navigate(`/history/${savedId}`);
      }, 600);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Không thể lưu thông tin chỉnh sửa. Vui lòng thử lại.'
      );
      setSubmitting(false);
    }
  };

  // Lưu tất cả các hóa đơn khi đang giữ > 1 bill
  const handleSaveAllMultiBills = async () => {
    if (!validateIncompleteItems()) return;
    setSubmitting(true);
    setError('');
    try {
      const updatedBills = [...multiBills];
      if (updatedBills[activeBillIdx]) {
        updatedBills[activeBillIdx] = {
          ...updatedBills[activeBillIdx],
          ...formData,
        };
      }

      for (const bill of updatedBills) {
        const bForm = buildFormDataFromInvoice(bill);
        const payload = {
          invoice_id: bill.invoice_id,
          store_name: (bForm.store_name || '').trim() || 'Cửa hàng chưa xác định',
          store_address: (bForm.store_address || '').trim(),
          date: (bForm.date || '').trim(),
          invoice_type: bForm.invoice_type || 'Other',
          subtotal: Math.round(Number(bForm.subtotal) || 0),
          tax_amount: Math.round(Number(bForm.tax_amount) || 0),
          total_amount: Math.round(Number(bForm.total_amount) || 0),
          items: (bForm.items || [])
            .filter((it) => (it.name || it.item_name || '').trim() !== '')
            .map((it) => {
              const cleanName = (it.name || it.item_name || '').trim();
              return {
                name: cleanName,
                item_name: cleanName,
                unit: (it.unit || '').trim(),
                quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
                unit_price: Math.round(Number(it.unit_price) || 0),
                total_price: Math.round(Number(it.total_price) || 0),
              };
            }),
          raw_text: bill.raw_text || '',
          image_path: bill.image_path || '',
          is_submitted: true,
        };
        await updateInvoice(bill.invoice_id, payload);
      }

      scanRuntimeStore.extractedInvoice = null;
      scanRuntimeStore.formData = null;
      scanRuntimeStore.preview = null;
      scanRuntimeStore.fileMeta = null;
      scanRuntimeStore.multiBills = [];
      scanRuntimeStore.showMultiModal = false;
      notifyRuntimeListeners();

      showToast(`Đã lưu thành công toàn bộ ${updatedBills.length} hóa đơn!`);
      setTimeout(() => {
        navigate('/history');
      }, 600);
    } catch (err) {
      setError(err.response?.data?.detail || 'Lỗi khi lưu hàng loạt hóa đơn.');
      setSubmitting(false);
    }
  };

  const executeResetScan = async () => {
    setConfirmResetOpen(false);
    const idsToClean = new Set();
    if (extractedInvoice?.invoice_id) idsToClean.add(extractedInvoice.invoice_id);
    multiBills.forEach((b) => {
      if (b?.invoice_id) idsToClean.add(b.invoice_id);
    });

    for (const id of idsToClean) {
      try {
        await deleteInvoice(id, 'Người dùng hủy kết quả quét');
      } catch (e) {
        // Ignore cleanup error
      }
    }

    setSelectedFiles([]);
    scanRuntimeStore.extractedInvoice = null;
    scanRuntimeStore.formData = null;
    scanRuntimeStore.preview = null;
    scanRuntimeStore.fileMeta = null;
    scanRuntimeStore.multiBills = [];
    scanRuntimeStore.showMultiModal = false;
    scanRuntimeStore.error = '';
    scanRuntimeStore.duplicateAlert = null;
    notifyRuntimeListeners();
  };

  const handleRequestReset = () => {
    if (extractedInvoice) {
      setConfirmResetOpen(true);
    } else {
      executeResetScan();
    }
  };

  const formatVND = (num) => {
    return Math.round(Number(num) || 0).toLocaleString('vi-VN') + ' đ';
  };

  return (
    <div className="scan-page scan-page-wide">
      {toast && (
        <div className={`toast ${toast.type}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {toast.type === 'error' ? (
            <AlertTriangle size={16} strokeWidth={1.75} />
          ) : (
            <CheckCircle2 size={16} strokeWidth={1.75} />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header (Hỗ trợ song song Hóa đơn SROIE & Tài liệu Biểu mẫu FUNSD) */}
      <div className="scan-header-bar">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
            {extractedInvoice
              ? formData.invoice_type === 'Document/Form'
                ? 'Kiểm tra & Xác nhận Tài liệu / Biểu mẫu (FUNSD)'
                : 'Kiểm tra & Xác nhận Hóa đơn (SROIE)'
              : 'Quét Hóa đơn & Tài liệu AI (SROIE / FUNSD)'}
          </h2>
        </div>

        <div className="scan-step-pills">
          <span className={`scan-step-pill ${!extractedInvoice ? 'active' : 'done'}`}>
            <span className="pill-num">1</span> Tải ảnh chứng từ
          </span>
          <span className="scan-step-sep" />
          <span className={`scan-step-pill ${extractedInvoice ? 'active' : ''}`}>
            <span className="pill-num">2</span> Kiểm duyệt & Lưu
          </span>
        </div>
      </div>

      {error && (
        <div className="error-msg" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={17} strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {/* Duplicate Invoice Alert Banner */}
      {duplicateAlert && !loading && !extractedInvoice && (
        <div className="scan-duplicate-alert">
          <div className="scan-dup-icon-wrap" style={{ color: '#d97706' }}>
            <AlertTriangle size={22} strokeWidth={1.75} />
          </div>
          <div className="scan-dup-content">
            <div className="scan-dup-header">
              <h4 className="scan-dup-title">Phát hiện hóa đơn trùng lặp</h4>
              <span className="scan-dup-badge">Đã tồn tại</span>
            </div>
            <p className="scan-dup-detail">{duplicateAlert.message}</p>
            <p className="scan-dup-hint">
              Bạn có thể mở xem hóa đơn đã lưu trước đó, hoặc chọn <strong>Quét đè</strong> nếu muốn cập nhật lại dữ liệu mới.
            </p>
            <div className="scan-dup-actions">
              {duplicateAlert.existing_invoice_id && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: 'auto' }}
                  onClick={() => navigate(`/history/${duplicateAlert.existing_invoice_id}`)}
                >
                  <Eye size={15} strokeWidth={1.75} />
                  Xem hóa đơn đã tồn tại
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleScan(true)}
              >
                <RotateCcw size={15} strokeWidth={1.75} />
                Vẫn tiếp tục quét đè
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={executeResetScan}
              >
                Chọn ảnh khác
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LOADING STATE ==================== */}
      {loading ? (
        <div className="scan-tech-overlay">
          <div className="scan-tech-card">
            <div className="scan-tech-visual">
              {preview && (
                <img
                  src={preview}
                  alt="Scanning"
                  className="scan-tech-img"
                />
              )}
              <div className="scan-tech-laser"></div>
              <div className="scan-tech-grid"></div>
              <div className="scan-hud-corner hud-tl"></div>
              <div className="scan-hud-corner hud-tr"></div>
              <div className="scan-hud-corner hud-bl"></div>
              <div className="scan-hud-corner hud-br"></div>
            </div>

            <div className="scan-tech-info">
              <div className="spinner" style={{ margin: '0 auto 14px', width: '40px', height: '40px' }}></div>
              <h3>AI đang phân tích & bóc tách hóa đơn...</h3>
              <p className="scan-tech-sub">
                Tiến trình được tự động lưu nền — bạn có thể chuyển sang tab khác mà không sợ mất dữ liệu đang quét.
              </p>

              <div className="scan-steps-list">
                <div className="scan-step-item done">
                  <span className="step-dot"><Check size={13} strokeWidth={2.2} /></span>
                  <span>Tiền xử lý ảnh & cân chỉnh phối cảnh</span>
                </div>
                <div className="scan-step-item active">
                  <span className="step-dot"><Cpu size={13} strokeWidth={1.75} /></span>
                  <span>Nhận diện văn bản OCR & trích xuất thông tin AI</span>
                </div>
                <div className="scan-step-item">
                  <span className="step-dot">3</span>
                  <span>Chuẩn bị bảng dữ liệu để bạn kiểm tra</span>
                </div>
              </div>

              <div className="scan-progress-bar-wrap">
                <div
                  className="scan-progress-bar-fill"
                  style={{ width: '75%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      ) : !extractedInvoice ? (
        /* ==================== STEP 1: 2-COLUMN UPLOAD + LIVE PREVIEW ==================== */
        <div className="scan-step1-grid">
          <div className="scan-left-col">
            <div
              className={`scan-dropzone-card ${isDragging ? 'is-dragging' : ''} ${preview ? 'has-file' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="scan-hud-corner hud-tl"></div>
              <div className="scan-hud-corner hud-tr"></div>
              <div className="scan-hud-corner hud-bl"></div>
              <div className="scan-hud-corner hud-br"></div>

              <div className="scan-dropzone-icon">
                <UploadCloud size={32} strokeWidth={1.75} />
              </div>

              <h3>Kéo thả ảnh Hóa đơn (SROIE) hoặc Tài liệu / Biểu mẫu (FUNSD) vào đây</h3>
              <p className="scan-dropzone-sub">
                Hỗ trợ tự động nhận diện cả Hóa đơn mua bán lẫn Biểu mẫu hành chính/khoa học có cấu trúc Key-Value & Checkbox (JPG, PNG, WEBP).
              </p>

              <div
                className="scan-dropzone-btns"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: 'auto', padding: '10px 18px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon size={17} strokeWidth={1.75} />
                  Chọn ảnh từ máy
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ width: 'auto', padding: '10px 18px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText size={17} strokeWidth={1.75} />
                  Chọn nhiều hóa đơn
                </button>
              </div>

              {fileMeta && (
                <div className="scan-selected-pill" title={`${fileMeta.name} (${(fileMeta.size / 1024).toFixed(1)} KB)`}>
                  <CheckCircle2 size={14} strokeWidth={1.75} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <span className="scan-file-name-wrap">
                    Đã chọn: <strong className="scan-file-name">{fileMeta.name}</strong> ({(fileMeta.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFilesSelect(e.target.files)}
              />
            </div>

            <div className="scan-tips-card">
              <div className="scan-tips-header">
                <ShieldCheck size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                <h4>Gợi ý chụp ảnh chuẩn OCR</h4>
              </div>
              <ul className="scan-tips-list">
                <li>
                  <Check size={15} strokeWidth={2} className="tip-check" />
                  <span>Đặt hóa đơn trên mặt phẳng đủ sáng, tránh bóng đổ che khuất chữ số.</span>
                </li>
                <li>
                  <Check size={15} strokeWidth={2} className="tip-check" />
                  <span>Chụp vuông góc toàn bộ mặt hóa đơn (từ tên cửa hàng đến tổng tiền ở đáy).</span>
                </li>
                <li>
                  <Check size={15} strokeWidth={2} className="tip-check" />
                  <span>Nếu tải lên nhiều hóa đơn cùng lúc, hệ thống sẽ hỏi bạn muốn giữ hóa đơn nào hoặc giữ tất cả.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="scan-right-col">
            <div className="scan-preview-panel">
              <div className="scan-preview-panel-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={18} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                  <h4>Xem trước & Kết quả bóc tách</h4>
                </div>
                {preview && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${cropMode ? 'btn-primary' : 'btn-outline'}`}
                      style={{ padding: '4px 10px', fontSize: '12.5px' }}
                      onClick={() => setCropMode((v) => !v)}
                      title="Cắt viền ảnh hoặc cắt riêng 1 hóa đơn"
                      disabled={loading || imageProcessing}
                    >
                      <Crop size={14} strokeWidth={1.75} />
                      {cropMode ? 'Đang cắt' : 'Cắt viền ảnh (Crop)'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ padding: '4px 10px', fontSize: '12.5px' }}
                      onClick={handleRotatePreview}
                      title="Xoay ảnh 90 độ"
                      disabled={loading || imageProcessing}
                    >
                      <RotateCw size={14} strokeWidth={1.75} />
                      Xoay
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 8px', fontSize: '12.5px' }}
                      onClick={executeResetScan}
                      disabled={loading || imageProcessing}
                      title="Chọn ảnh khác"
                    >
                      <RotateCcw size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                )}
              </div>

              {!preview ? (
                <div className="scan-preview-empty">
                  <div className="scan-empty-illustration">
                    <Receipt size={38} strokeWidth={1.5} />
                  </div>
                  <h4>Chưa có chứng từ nào được chọn</h4>
                  <p>
                    Sau khi bạn tải ảnh hóa đơn ở khung bên trái, bản xem trước và nút kích hoạt AI OCR sẽ xuất hiện tại đây.
                  </p>
                  <div className="scan-empty-features">
                    <span><Sparkles size={14} strokeWidth={1.75} /> Tự động nhận diện tên cửa hàng & thuế GTGT</span>
                    <span><ListChecks size={14} strokeWidth={1.75} /> Bóc tách chi tiết từng dòng sản phẩm & đơn vị</span>
                  </div>
                </div>
              ) : cropMode ? (
                <div className="scan-crop-container" style={{ padding: '12px 14px' }}>
                  <div
                    ref={cropBoxRef}
                    className="scan-crop-stage"
                    style={{
                      position: 'relative',
                      userSelect: 'none',
                      width: '100%',
                      maxHeight: '320px',
                      overflow: 'hidden',
                      background: '#090d16',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      touchAction: 'none',
                    }}
                  >
                    <img
                      src={preview}
                      alt="Crop Source"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '300px',
                        objectFit: 'contain',
                        display: 'block',
                        opacity: 0.55,
                        pointerEvents: 'none',
                      }}
                    />

                    {/* Vùng chọn cắt sáng rõ */}
                    <div
                      style={{
                        position: 'absolute',
                        top: `${cropRect.top}%`,
                        bottom: `${cropRect.bottom}%`,
                        left: `${cropRect.left}%`,
                        right: `${cropRect.right}%`,
                        border: '2px solid #6366f1',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55), inset 0 0 12px rgba(99, 102, 241, 0.45)',
                        pointerEvents: 'none',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gridTemplateRows: '1fr 1fr 1fr',
                          opacity: 0.4,
                        }}
                      >
                        <div style={{ borderRight: '1px dashed #fff', borderBottom: '1px dashed #fff' }} />
                        <div style={{ borderRight: '1px dashed #fff', borderBottom: '1px dashed #fff' }} />
                        <div style={{ borderBottom: '1px dashed #fff' }} />
                        <div style={{ borderRight: '1px dashed #fff', borderBottom: '1px dashed #fff' }} />
                        <div style={{ borderRight: '1px dashed #fff', borderBottom: '1px dashed #fff' }} />
                        <div style={{ borderBottom: '1px dashed #fff' }} />
                        <div style={{ borderRight: '1px dashed #fff' }} />
                        <div style={{ borderRight: '1px dashed #fff' }} />
                        <div />
                      </div>
                    </div>

                    {/* 4 Nút kéo góc */}
                    <div
                      onPointerDown={(e) => { e.preventDefault(); setDragCorner('tl'); }}
                      style={{
                        position: 'absolute',
                        top: `${cropRect.top}%`,
                        left: `${cropRect.left}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '18px',
                        height: '18px',
                        background: '#6366f1',
                        border: '2px solid #fff',
                        borderRadius: '4px',
                        cursor: 'nwse-resize',
                        zIndex: 20,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      }}
                      title="Kéo góc trên-trái"
                    />
                    <div
                      onPointerDown={(e) => { e.preventDefault(); setDragCorner('tr'); }}
                      style={{
                        position: 'absolute',
                        top: `${cropRect.top}%`,
                        right: `${cropRect.right}%`,
                        transform: 'translate(50%, -50%)',
                        width: '18px',
                        height: '18px',
                        background: '#6366f1',
                        border: '2px solid #fff',
                        borderRadius: '4px',
                        cursor: 'nesw-resize',
                        zIndex: 20,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      }}
                      title="Kéo góc trên-phải"
                    />
                    <div
                      onPointerDown={(e) => { e.preventDefault(); setDragCorner('bl'); }}
                      style={{
                        position: 'absolute',
                        bottom: `${cropRect.bottom}%`,
                        left: `${cropRect.left}%`,
                        transform: 'translate(-50%, 50%)',
                        width: '18px',
                        height: '18px',
                        background: '#6366f1',
                        border: '2px solid #fff',
                        borderRadius: '4px',
                        cursor: 'nesw-resize',
                        zIndex: 20,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      }}
                      title="Kéo góc dưới-trái"
                    />
                    <div
                      onPointerDown={(e) => { e.preventDefault(); setDragCorner('br'); }}
                      style={{
                        position: 'absolute',
                        bottom: `${cropRect.bottom}%`,
                        right: `${cropRect.right}%`,
                        transform: 'translate(50%, 50%)',
                        width: '18px',
                        height: '18px',
                        background: '#6366f1',
                        border: '2px solid #fff',
                        borderRadius: '4px',
                        cursor: 'nwse-resize',
                        zIndex: 20,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      }}
                      title="Kéo góc dưới-phải"
                    />
                  </div>

                  {/* Thanh trượt điều chỉnh tinh & Nút áp dụng */}
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      background: 'var(--bg-main)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>Kéo 4 góc trên ảnh hoặc kéo thanh trượt dưới:</span>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        Giữ lại: {Math.max(10, Math.round(100 - cropRect.left - cropRect.right))}% ×{' '}
                        {Math.max(10, Math.round(100 - cropRect.top - cropRect.bottom))}%
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Cắt mép Trên: <strong>{Math.round(cropRect.top)}%</strong>
                        <input
                          type="range"
                          min="0"
                          max="45"
                          value={cropRect.top}
                          onChange={(e) => handleCropSlider('top', e.target.value)}
                          style={{ width: '100%', accentColor: 'var(--primary)' }}
                        />
                      </label>
                      <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Cắt mép Dưới: <strong>{Math.round(cropRect.bottom)}%</strong>
                        <input
                          type="range"
                          min="0"
                          max="45"
                          value={cropRect.bottom}
                          onChange={(e) => handleCropSlider('bottom', e.target.value)}
                          style={{ width: '100%', accentColor: 'var(--primary)' }}
                        />
                      </label>
                      <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Cắt mép Trái: <strong>{Math.round(cropRect.left)}%</strong>
                        <input
                          type="range"
                          min="0"
                          max="45"
                          value={cropRect.left}
                          onChange={(e) => handleCropSlider('left', e.target.value)}
                          style={{ width: '100%', accentColor: 'var(--primary)' }}
                        />
                      </label>
                      <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Cắt mép Phải: <strong>{Math.round(cropRect.right)}%</strong>
                        <input
                          type="range"
                          min="0"
                          max="45"
                          value={cropRect.right}
                          onChange={(e) => handleCropSlider('right', e.target.value)}
                          style={{ width: '100%', accentColor: 'var(--primary)' }}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={handleCancelCrop}
                        disabled={imageProcessing}
                      >
                        Hủy cắt
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleApplyCrop}
                        disabled={imageProcessing}
                        style={{ width: 'auto' }}
                      >
                        <Check size={14} strokeWidth={2} />
                        {imageProcessing ? 'Đang cắt ảnh...' : 'Áp dụng cắt'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="scan-preview-ready">
                  <div className="scan-live-img-frame" style={{ maxHeight: '250px', minHeight: '200px' }}>
                    <img src={preview} alt="Receipt Preview" className="scan-live-img" style={{ maxHeight: '226px' }} />
                    <div className="scan-ambient-laser"></div>
                  </div>

                  <div className="scan-ready-footer">
                    <div className="scan-ready-meta">
                      <strong className="scan-file-name" title={fileMeta?.name || 'Ảnh chứng từ'}>
                        {fileMeta?.name || 'Ảnh chứng từ'}
                      </strong>
                      <span>
                        {fileMeta?.count > 1
                          ? `Đã chọn ${fileMeta.count} chứng từ`
                          : 'Sẵn sàng phân tích bằng AI OCR'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-glow"
                      style={{ width: '100%', padding: '14px 24px', fontSize: '15px' }}
                      onClick={() => handleScan(false)}
                      disabled={loading}
                    >
                      <Sparkles size={18} strokeWidth={1.75} />
                      {fileMeta?.count > 1
                        ? `Bắt đầu đọc & bóc tách (${fileMeta.count} hóa đơn)`
                        : 'Bắt đầu đọc & bóc tách'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ==================== STEP 2: REVIEW & EDIT FORM ==================== */
        <form onSubmit={handleConfirmSubmit} className="scan-review-wrap">
          {/* Thanh chuyển đổi khi người dùng giữ > 1 hóa đơn */}
          {multiBills.length > 1 && (
            <div className="scan-multi-switcher">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13.5px', color: 'var(--primary)' }}>
                  <Layers size={16} strokeWidth={1.75} />
                  Đang kiểm duyệt {multiBills.length} hóa đơn:
                </span>
                {multiBills.map((b, idx) => (
                  <button
                    key={b.invoice_id}
                    type="button"
                    className={`chip ${idx === activeBillIdx ? 'active' : ''}`}
                    onClick={() => handleSwitchActiveBill(idx)}
                  >
                    HĐ #{idx + 1}: {b.store_name || 'Cửa hàng'} ({formatVND(b.total_amount)})
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    scanRuntimeStore.showMultiModal = true;
                    notifyRuntimeListeners();
                  }}
                >
                  Chọn lại HĐ muốn giữ
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: 'auto' }}
                  onClick={handleSaveAllMultiBills}
                  disabled={submitting}
                >
                  <CheckCircle2 size={15} strokeWidth={1.75} />
                  Lưu tất cả ({multiBills.length} HĐ)
                </button>
              </div>
            </div>
          )}

          <div className="scan-review-grid">
            {/* Left Column: Compact Original Receipt Image (Thu nhỏ khung ảnh theo feedback) */}
            <div className="scan-review-left">
              <div className="scan-review-card sticky-card">
                <div className="scan-card-header">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                    <ImageIcon size={16} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                    Ảnh chứng từ gốc
                  </h4>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => setZoomImage(!zoomImage)}
                  >
                    {zoomImage ? <ZoomOut size={14} strokeWidth={1.75} /> : <ZoomIn size={14} strokeWidth={1.75} />}
                    {zoomImage ? 'Thu nhỏ' : 'Phóng to'}
                  </button>
                </div>

                <div className={`scan-review-img-box ${zoomImage ? 'zoomed' : ''}`}>
                  {preview && (
                    <img
                      src={preview}
                      alt="Invoice Original"
                      className="scan-review-img"
                    />
                  )}
                </div>

                {fileMeta && (
                  <div
                    className="scan-review-file-meta"
                    title={`${fileMeta.name} • ${(fileMeta.size / 1024).toFixed(1)} KB`}
                  >
                    <span className="scan-file-name">{fileMeta.name}</span>
                    <span style={{ flexShrink: 0 }}>•</span>
                    <span style={{ flexShrink: 0 }}>{(fileMeta.size / 1024).toFixed(1)} KB</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Expanded Editable Fields (Mở rộng phần thông tin hóa đơn lớn hơn) */}
            <div className="scan-review-right">
              {/* General Info Card */}
              <div className="scan-review-card">
                <div className="scan-card-header">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Store size={17} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                    Thông tin chung
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formData.invoice_type === 'Document/Form' ? 'Mã tài liệu' : 'Mã HĐ'}: #{extractedInvoice.invoice_id?.slice(-8)}
                  </span>
                </div>

                <div className="scan-form-grid">
                  <div className="form-group">
                    <label>
                      {formData.invoice_type === 'Document/Form'
                        ? 'Tiêu đề tài liệu / Đơn vị phát hành *'
                        : 'Tên cửa hàng / Đơn vị bán *'}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.store_name}
                      onChange={(e) => handleFieldChange('store_name', e.target.value)}
                      placeholder={
                        formData.invoice_type === 'Document/Form'
                          ? 'Nhập tiêu đề biểu mẫu hoặc đơn vị phát hành...'
                          : 'Nhập tên cửa hàng...'
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      {formData.invoice_type === 'Document/Form'
                        ? 'Ngày tài liệu / Ngày đăng ký'
                        : 'Ngày phát hành hóa đơn'}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.date}
                      onChange={(e) => handleFieldChange('date', e.target.value)}
                      placeholder="VD: 23/02/2019"
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>
                      {formData.invoice_type === 'Document/Form'
                        ? 'Địa chỉ / Người đăng ký / Nguồn'
                        : 'Địa chỉ cửa hàng'}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.store_address}
                      onChange={(e) => handleFieldChange('store_address', e.target.value)}
                      placeholder={
                        formData.invoice_type === 'Document/Form'
                          ? 'Nhập địa chỉ, phòng ban, nguồn hoặc người đăng ký...'
                          : 'Nhập địa chỉ trên hóa đơn...'
                      }
                    />
                  </div>

                  <div
                    className="form-group"
                    style={formData.invoice_type === 'Document/Form' ? { gridColumn: '1 / -1' } : undefined}
                  >
                    <label>Phân loại chứng từ</label>
                    <select
                      className="form-input"
                      value={formData.invoice_type}
                      onChange={(e) => handleFieldChange('invoice_type', e.target.value)}
                    >
                      <option value="Document/Form">Tài liệu / Biểu mẫu hành chính (FUNSD)</option>
                      <option value="Supermarket">Siêu thị / Bán lẻ (Supermarket)</option>
                      <option value="Cafe/Restaurant">Nhà hàng / Đồ uống (F&B)</option>
                      <option value="Utility">Hóa đơn tiện ích (Điện, Nước, Viễn thông)</option>
                      <option value="Shopping">Mua sắm (Shopping)</option>
                      <option value="Other">Khác (Other)</option>
                    </select>
                  </div>

                  {formData.invoice_type !== 'Document/Form' && (
                    <div className="form-group">
                      <label>Tiền thuế VAT (đ) — Tự động tính từ Backend</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.tax_amount}
                        onChange={(e) => handleFieldChange('tax_amount', e.target.value)}
                        min="0"
                        step="any"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items / Key-Value Fields Card */}
              <div className="scan-review-card">
                <div className="scan-card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ListChecks size={17} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                    {formData.invoice_type === 'Document/Form'
                      ? 'Các trường thông tin bóc tách'
                      : `Danh sách sản phẩm (${formData.items.length})`}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedItemIndices.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ width: 'auto' }}
                        onClick={() => setConfirmBulkDeleteOpen(true)}
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                        Xóa đã chọn ({selectedItemIndices.length})
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handleAddItem}
                    >
                      <Plus size={15} strokeWidth={1.75} />
                      {formData.invoice_type === 'Document/Form' ? 'Thêm trường' : 'Thêm dòng'}
                    </button>
                  </div>
                </div>

                {formData.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>
                    {formData.invoice_type === 'Document/Form' ? (
                      <>
                        Chưa có trường thông tin nào được bóc tách. Nhấn <strong>"Thêm trường"</strong> để nhập bổ sung.
                      </>
                    ) : (
                      <>
                        Chưa có mặt hàng nào được bóc tách. Nhấn <strong>"Thêm dòng"</strong> để nhập bổ sung.
                      </>
                    )}
                  </div>
                ) : formData.invoice_type === 'Document/Form' ? (
                  <div className="scan-items-table-wrap">
                    <table className="scan-items-table">
                      <thead>
                        <tr>
                          <th style={{ width: '5%', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={
                                formData.items.length > 0 &&
                                selectedItemIndices.length === formData.items.length
                              }
                              onChange={handleToggleSelectAllItems}
                              title="Chọn tất cả các trường"
                              style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                          </th>
                          <th style={{ width: '6%', textAlign: 'center' }}>STT</th>
                          <th style={{ width: '28%' }}>Tên trường thông tin *</th>
                          <th style={{ width: '53%' }}>Nội dung chi tiết</th>
                          <th style={{ width: '8%', textAlign: 'center' }}>Xóa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, idx) => {
                          const parts = getFieldParts(item);
                          return (
                            <tr key={idx}>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedItemIndices.includes(idx)}
                                  onChange={() => handleToggleSelectItem(idx)}
                                  style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                />
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                                {idx + 1}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-input form-input-sm"
                                  style={{ fontWeight: 600 }}
                                  value={parts.key}
                                  onChange={(e) => handleDocItemChange(idx, 'key', e.target.value)}
                                  placeholder="VD: Họ và tên, Cam kết 1..."
                                />
                              </td>
                              <td>
                                <textarea
                                  rows={1}
                                  className="form-input form-input-sm"
                                  style={{
                                    resize: 'vertical',
                                    minHeight: '34px',
                                    lineHeight: '1.45',
                                    fontFamily: 'inherit',
                                  }}
                                  value={parts.val}
                                  onChange={(e) => {
                                    handleDocItemChange(idx, 'val', e.target.value);
                                    autoResizeTextarea(e.target);
                                  }}
                                  onFocus={(e) => autoResizeTextarea(e.target)}
                                  placeholder="Nhập nội dung chi tiết của trường này..."
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn-icon-danger"
                                  onClick={() => confirmRemoveItem(idx)}
                                  title="Xóa trường thông tin này"
                                >
                                  <Trash2 size={14} strokeWidth={1.75} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="scan-items-table-wrap">
                    <table className="scan-items-table">
                      <thead>
                        <tr>
                          <th style={{ width: '34%' }}>Tên mặt hàng *</th>
                          <th style={{ width: '13%', textAlign: 'center' }}>Đơn vị</th>
                          <th style={{ width: '11%', textAlign: 'center' }}>SL</th>
                          <th style={{ width: '18%', textAlign: 'right' }}>Đơn giá (đ)</th>
                          <th style={{ width: '18%', textAlign: 'right' }}>Thành tiền (đ)</th>
                          <th style={{ width: '6%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                className="form-input form-input-sm"
                                value={item.name}
                                onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                placeholder="Nhập tên sản phẩm..."
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-input form-input-sm"
                                style={{ textAlign: 'center' }}
                                value={item.unit || ''}
                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                placeholder="Cái, Lon..."
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-input form-input-sm"
                                style={{ textAlign: 'center' }}
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                min="1"
                                step="any"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-input form-input-sm"
                                style={{ textAlign: 'right' }}
                                value={item.unit_price}
                                onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                                min="0"
                                step="any"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-input form-input-sm"
                                style={{ textAlign: 'right', fontWeight: 600 }}
                                value={item.total_price}
                                onChange={(e) => handleItemChange(idx, 'total_price', e.target.value)}
                                min="0"
                                step="any"
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn-icon-danger"
                                onClick={() => confirmRemoveItem(idx)}
                                title="Xóa dòng này"
                              >
                                <Trash2 size={14} strokeWidth={1.75} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payment Summary Card (Chỉ hiện khi là Hóa đơn mua bán, ẩn khi là Tài liệu / Biểu mẫu) */}
              {formData.invoice_type !== 'Document/Form' && (
                <div className="scan-review-card scan-total-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div className="scan-total-label">Tổng thanh toán cuối cùng (VNĐ) *</div>
                      <div className="scan-total-display">{formatVND(formData.total_amount)}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={handleRecalculateTotal}
                        title="Tính lại tổng thành tiền từ danh sách các dòng sản phẩm"
                      >
                        Tính lại từ các mặt hàng
                      </button>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '180px', fontWeight: 700, fontSize: '16px', textAlign: 'right' }}
                        value={formData.total_amount}
                        onChange={(e) => handleFieldChange('total_amount', e.target.value)}
                        min="0"
                        step="any"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons (Chỉ giữ 1 nút Hủy & Quét lại duy nhất theo feedback) */}
              <div className="scan-review-bottom-bar">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleRequestReset}
                  disabled={submitting}
                >
                  <RotateCcw size={16} strokeWidth={1.75} />
                  Hủy & Quét lại
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-glow"
                  style={{ width: 'auto', minWidth: '240px' }}
                  disabled={submitting}
                >
                  <CheckCircle2 size={18} strokeWidth={1.75} />
                  {submitting
                    ? formData.invoice_type === 'Document/Form'
                      ? 'Đang lưu tài liệu...'
                      : 'Đang lưu & khóa dữ liệu...'
                    : multiBills.length > 1
                    ? `Xác nhận & Lưu ${formData.invoice_type === 'Document/Form' ? 'tài liệu' : 'HĐ'} #${activeBillIdx + 1}`
                    : formData.invoice_type === 'Document/Form'
                    ? 'Xác nhận & Lưu tài liệu'
                    : 'Xác nhận & Lưu hóa đơn'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* MODAL 1: Phát hiện > 1 hóa đơn -> Hỏi user muốn giữ cái nào hay giữ hết */}
      {showMultiModal && multiBills.length > 1 && (
        <div className="modal-overlay" onClick={() => setShowMultiModal(false)}>
          <div className="modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                Phát hiện {multiBills.length} hóa đơn trong lần quét này
              </h3>
              <button className="modal-close" onClick={() => setShowMultiModal(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Hệ thống nhận diện được <strong>{multiBills.length} hóa đơn</strong>. Bạn muốn chọn giữ lại hóa đơn nào hay giữ tất cả?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
              {multiBills.map((bill, idx) => {
                const checked = selectedBillIds.includes(bill.invoice_id);
                return (
                  <label
                    key={bill.invoice_id}
                    onClick={() => handleToggleSelectBill(bill.invoice_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: checked ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      background: checked ? 'var(--primary-bg)' : 'var(--bg-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="trash-checkbox"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                        Hóa đơn #{idx + 1}: {bill.store_name || 'Cửa hàng chưa xác định'}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Ngày: {bill.date || 'Chưa rõ'} • {(bill.items || []).length} mặt hàng
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '14.5px' }}>
                      {formatVND(bill.total_amount)}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleKeepSelectedBills(false)}
              >
                Giữ hóa đơn đã chọn ({selectedBillIds.length})
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleKeepSelectedBills(true)}
              >
                <CheckCircle2 size={16} strokeWidth={1.75} />
                Giữ tất cả ({multiBills.length} hóa đơn)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Xác nhận xóa dòng mặt hàng / trường thông tin */}
      {confirmDeleteItemIdx !== null && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteItemIdx(null)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {formData.invoice_type === 'Document/Form'
                  ? 'Xác nhận xóa trường thông tin'
                  : 'Xác nhận xóa dòng mặt hàng'}
              </h3>
              <button className="modal-close" onClick={() => setConfirmDeleteItemIdx(null)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Bạn có chắc chắn muốn xóa {formData.invoice_type === 'Document/Form' ? 'trường thông tin' : 'mặt hàng'}{' '}
              <strong>
                "{formData.items[confirmDeleteItemIdx]?.name || `Dòng #${confirmDeleteItemIdx + 1}`}"
              </strong>{' '}
              khỏi {formData.invoice_type === 'Document/Form' ? 'tài liệu' : 'hóa đơn'} này không?
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmDeleteItemIdx(null)}>
                Hủy
              </button>
              <button type="button" className="btn btn-danger" onClick={executeRemoveItem}>
                <Trash2 size={15} strokeWidth={1.75} />
                Chắc chắn xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2B: Xác nhận xóa nhiều trường thông tin đã chọn */}
      {confirmBulkDeleteOpen && selectedItemIndices.length > 0 && (
        <div className="modal-overlay" onClick={() => setConfirmBulkDeleteOpen(false)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Xác nhận xóa {selectedItemIndices.length} trường đã chọn</h3>
              <button className="modal-close" onClick={() => setConfirmBulkDeleteOpen(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Bạn có chắc chắn muốn xóa bớt <strong>{selectedItemIndices.length} trường thông tin</strong> đã chọn khỏi tài liệu này không?
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmBulkDeleteOpen(false)}>
                Hủy
              </button>
              <button type="button" className="btn btn-danger" onClick={executeBulkRemoveItems}>
                <Trash2 size={15} strokeWidth={1.75} />
                Chắc chắn xóa ({selectedItemIndices.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Xác nhận Hủy & Quét lại */}
      {confirmResetOpen && (
        <div className="modal-overlay" onClick={() => setConfirmResetOpen(false)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Hủy kết quả quét hiện tại?</h3>
              <button className="modal-close" onClick={() => setConfirmResetOpen(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Bạn có chắc chắn muốn xóa bản nháp hóa đơn đang kiểm tra để quét lại ảnh mới không?
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmResetOpen(false)}>
                Quay lại kiểm tra
              </button>
              <button type="button" className="btn btn-danger" onClick={executeResetScan}>
                <Trash2 size={15} strokeWidth={1.75} />
                Chắc chắn hủy & quét lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
