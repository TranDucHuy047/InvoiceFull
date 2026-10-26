# Vision outputs

Các output thực nghiệm được sinh lại khi chạy script, không dùng kết quả cũ để tránh lệch cấu hình.

- `dataset_analysis.json`: tạo bởi `00_analyze_dataset.py`, gồm SROIE + FUNSD khi chạy `--dataset all`.
- `evaluation/`: ảnh gốc/mờ/nghiêng/thiếu sáng và CSV tương thích QA của Loan.
- `experiment_09/`: tuning OpenCV.
- `experiment_10/`: so sánh Có/Không preprocessing theo từng source (`sroie`, `funsd`, `manifest`).
- `experiment_11/`: biểu đồ WER/OCR Accuracy trước/sau preprocessing.

Các output ảnh OpenCV cơ bản có thể được giữ để minh họa; dataset/model vẫn được lấy qua cache, không đóng gói thủ công.
