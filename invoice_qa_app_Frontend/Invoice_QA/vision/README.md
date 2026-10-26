# Vision — SROIE + FUNSD + OpenCV + PaddleOCR

Pipeline Vision của Thúy:

```text
SROIE / FUNSD / ảnh tự chụp
→ OpenCV: denoise + CLAHE + deskew rotate-bound + sharpen nhẹ
→ PaddleOCR
→ OCR text / confidence / bounding boxes
```

## Vai trò dataset

- **SROIE**: dataset hóa đơn chính để OCR và đánh giá tiền xử lý.
- **FUNSD**: được khảo sát/phân tích theo yêu cầu đề cương và được script Đợt 10 hỗ trợ khi cần thử nghiệm.
- **50 ảnh tự chụp**: Loan chuẩn bị/gán nhãn; Thúy nhận qua `sample_data/manifest.csv` để chạy PaddleOCR Có/Không preprocessing.

Không đóng gói dataset thủ công vào source. `datasets.load_dataset()` tải lần đầu và dùng cache của Hugging Face.

## Cài đặt

```powershell
cd vision
pip install -r requirements.txt
```

PyTorch chỉ phục vụ môi trường/nghiên cứu Đợt 1:

```powershell
pip install -r requirements-research.txt
```

## Đợt 1 — phân tích SROIE + FUNSD

```powershell
python scripts/00_check_environment.py
python scripts/00_analyze_dataset.py --dataset all --split all
python scripts/01_opencv_basic.py --split train --index 0
```

## Đợt 2 — PaddleOCR trên SROIE

```powershell
python scripts/02_ocr_demo.py --split train --index 0 --lang en
```

## Đợt 3 — preprocessing

```powershell
python scripts/03_preprocess_invoice.py --split train --index 0
```

## Đợt 4/9 — mờ, nghiêng, thiếu sáng

```powershell
python scripts/04_evaluate_preprocessing.py --split test --limit 20 --variant all
python scripts/09_tune_preprocessing.py --split test --limit 20
```

`04_evaluate_preprocessing.py` giữ 13 cột đầu CSV đúng thứ tự mà `test/qa_evaluation_test.dart` của Loan đang đọc để tính WER/OCR Accuracy.

## Đợt 10 — Có/Không preprocessing

SROIE:

```powershell
python scripts/10_compare_preprocessing.py --source sroie --split test --limit 50 --lang en
```

FUNSD:

```powershell
python scripts/10_compare_preprocessing.py --source funsd --split test --limit 50 --lang en
```

50 ảnh tự chụp:

```powershell
python scripts/10_compare_preprocessing.py --source manifest --manifest sample_data/manifest.csv --limit 50 --lang vi
```

## Đợt 11 — biểu đồ WER / OCR Accuracy

```powershell
python scripts/11_plot_ocr_comparison.py --input outputs/experiment_10/ocr_preprocessing_comparison_sroie.csv
```

Script ưu tiên các cột metric chính thức do Loan xuất (`raw_wer`, `preprocessed_wer`, `raw_accuracy`, `preprocessed_accuracy`). Nếu chưa có, script có fallback tính từ text **chỉ để preview biểu đồ**; nghiệm thu vẫn lấy metric chính thức của Loan.

## Backend Huy import

```python
from vision.ocr_engine import process_image, process_image_result, process_image_payload
```

Chi tiết xem `../README_THUY.md`.
