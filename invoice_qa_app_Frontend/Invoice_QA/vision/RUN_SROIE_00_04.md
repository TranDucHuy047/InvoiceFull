# Chạy Vision Đợt 1 → 4 theo đề cương

```powershell
cd vision
pip install -r requirements.txt
```

## Đợt 1 — khảo sát SROIE + FUNSD

```powershell
python scripts/00_check_environment.py
python scripts/00_analyze_dataset.py --dataset all --split all
python scripts/01_opencv_basic.py --split train --index 0
```

## Đợt 2 — PaddleOCR trên SROIE

```powershell
python scripts/02_ocr_demo.py --split train --index 0 --lang en --ocr-version PP-OCRv5 --device cpu
```

## Đợt 3 — preprocessing

```powershell
python scripts/03_preprocess_invoice.py --split train --index 0
```

## Đợt 4 — ảnh gốc/mờ/nghiêng/thiếu sáng

```powershell
python scripts/04_evaluate_preprocessing.py --split test --start 0 --limit 20 --variant all --lang en
```

Vai trò dataset:
- SROIE: OCR hóa đơn và thực nghiệm chính.
- FUNSD: khảo sát/phân tích theo đề cương; có hỗ trợ ở Đợt 10.
- 50 ảnh tự chụp: dùng manifest khi Loan hoàn tất thu thập/gán nhãn.
