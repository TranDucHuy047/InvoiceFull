from adaptive_pipeline import adaptive_preprocess_invoice
import os
# Các cờ môi trường để tắt PIR và oneDNN tránh xung đột lõi
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_enable_pir_in_executor"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_new_ir_in_executor"] = "0"
os.environ["FLAGS_use_onednn"] = "0"
os.environ["PADDLE_USE_PIR"] = "0"
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"

from paddleocr import PaddleOCR
import numpy as np
import cv2
from PIL import Image, ImageOps
import io

# Tạo biến toàn cục rỗng, chỉ load model khi thực sự cần
ocr_model = None

def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Hàm nhận dữ liệu ảnh từ API (dạng bytes) và trả về text.
    Sử dụng PaddleOCR 2.x API.
    """
    global ocr_model
    
    # Lazy loading: Chỉ khởi tạo PaddleOCR nếu nó chưa có
    if ocr_model is None:
        print("[*] Đang khởi tạo mô hình PaddleOCR (chỉ chạy 1 lần)...")
        ocr_model = PaddleOCR(use_angle_cls=True, lang='vi', enable_mkldnn=False)
        
    # 1. Đọc ảnh bằng PIL để tự động sửa lỗi lật ngang (EXIF) của điện thoại
    image = Image.open(io.BytesIO(image_bytes))
    image = ImageOps.exif_transpose(image)
    
    # 2. Chuyển sang RGB nếu cần, rồi sang numpy array cho OpenCV
    if image.mode != 'RGB':
        image = image.convert('RGB')
    img_np = np.array(image)
    img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        
    # Tiền xử lý thích ứng thông minh (Adaptive Preprocessing)
    # Tự động nắn góc (>=3 deg), cân bằng sáng thích ứng (mu < 90), khử mờ/nếp nhăn không halo
    try:
        img_cv, preprocess_meta = adaptive_preprocess_invoice(img_cv)
        print(f"[DEBUG] Adaptive Preprocessing applied: {preprocess_meta.get('actions_taken', [])}")
    except Exception as e:
        print(f"[WARN] Lỗi khi tiền xử lý thích ứng, tiếp tục dùng ảnh gốc: {e}")
        
    # 3. Đưa vào PaddleOCR để đọc chữ
    result = ocr_model.ocr(img_cv, cls=True)
    
    # DEBUG
    print(f"[DEBUG] OCR result type: {type(result)}")
    if result:
        print(f"[DEBUG] result length: {len(result)}, result[0] type: {type(result[0]) if result[0] else 'None'}")
    
    # 4. Ráp các mảnh chữ lại thành một đoạn văn bản hoàn chỉnh theo dòng ngang (Y-coordinate Line Grouping)
    # PaddleOCR 2.x format: result[0] = list of [bbox, (text, confidence)]
    extracted_text = ""
    if result and result[0]:
        ocr_boxes = []
        for line in result[0]:
            try:
                bbox = line[0]
                text = str(line[1][0]).strip()
                if not text:
                    continue
                center_y = sum(pt[1] for pt in bbox) / 4.0
                min_x = min(pt[0] for pt in bbox)
                ocr_boxes.append({
                    "center_y": center_y,
                    "min_x": min_x,
                    "text": text
                })
            except Exception:
                continue

        # Sắp xếp các box từ trên xuống dưới theo center_y
        ocr_boxes.sort(key=lambda b: b["center_y"])

        # Gom các box có khoảng cách center_y gần nhau (<= 12 pixel) vào cùng một dòng ngang
        grouped_lines = []
        for box in ocr_boxes:
            if not grouped_lines:
                grouped_lines.append([box])
            else:
                last_line = grouped_lines[-1]
                avg_y = sum(b["center_y"] for b in last_line) / len(last_line)
                if abs(box["center_y"] - avg_y) <= 12.0:
                    last_line.append(box)
                else:
                    grouped_lines.append([box])

        # Trong từng dòng ngang, sắp xếp từ trái sang phải theo min_x và nối bằng "  "
        line_strings = []
        for line_group in grouped_lines:
            line_group.sort(key=lambda b: b["min_x"])
            line_strings.append("  ".join(b["text"] for b in line_group))

        extracted_text = "\n".join(line_strings)

    print(f"[DEBUG] Extracted {len(extracted_text.strip())} chars")
    return extracted_text.strip()