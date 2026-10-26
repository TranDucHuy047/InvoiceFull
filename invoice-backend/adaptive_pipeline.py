import os
import sys
import time
import math
import cv2
import numpy as np

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# --- THUẬT TOÁN ĐO ĐẠC CHỈ SỐ ẢNH ---

def measure_image_metrics(gray: np.ndarray):
    """Đo đạc 3 chỉ số quan trọng: Độ sáng trung bình, Độ tương phản, và Độ nét (Laplacian)"""
    mean_brightness = float(np.mean(gray))
    std_contrast = float(np.std(gray))
    blur_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    return {
        "brightness": mean_brightness,
        "contrast": std_contrast,
        "blur_var": blur_var
    }

def auto_detect_and_crop_receipt(img_bgr: np.ndarray, margin: int = 15) -> tuple[np.ndarray, bool]:
    """Phát hiện vùng giấy hóa đơn (sáng) trên nền tối/bàn và crop sát mép"""
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    corners = [thresh[0, 0], thresh[0, -1], thresh[-1, 0], thresh[-1, -1]]
    if sum(1 for c in corners if c == 255) >= 3:
        thresh = cv2.bitwise_not(thresh)
        
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return img_bgr, False
        
    c = max(contours, key=cv2.contourArea)
    rx, ry, rw, rh = cv2.boundingRect(c)
    
    # Hóa đơn phải chiếm ít nhất 20% chiều cao và 25% chiều rộng ảnh gốc, và nhỏ hơn toàn ảnh
    if rw >= w * 0.25 and rh >= h * 0.25 and (rw < w * 0.96 or rh < h * 0.96):
        rx = max(0, rx - margin)
        ry = max(0, ry - margin)
        rw = min(w - rx, rw + 2 * margin)
        rh = min(h - ry, rh + 2 * margin)
        cropped = img_bgr[ry:ry+rh, rx:rx+rw]
        return cropped, True
        
    return img_bgr, False

def estimate_skew_adaptive(gray: np.ndarray, max_abs_angle: float = 35.0) -> float:
    """Ước lượng góc nghiêng dòng chữ chính xác bằng HoughLinesP"""
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150, apertureSize=3)
    width = gray.shape[1]
    min_len = max(40, int(width * 0.15))
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=max(30, int(width * 0.04)), minLineLength=min_len, maxLineGap=20)
    
    angles = []
    if lines is not None and len(lines) > 0:
        lines_flat = lines.reshape(-1, 4)
        for x1, y1, x2, y2 in lines_flat:
            angle = math.degrees(math.atan2(float(y2 - y1), float(x2 - x1)))
            if -max_abs_angle <= angle <= max_abs_angle:
                angles.append(angle)
    if len(angles) >= 3:
        return float(np.median(angles))
    
    # Fallback to minAreaRect
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(bw > 0))
    if len(coords) >= 80:
        rect = cv2.minAreaRect(coords[:, ::-1].astype(np.float32))
        angle = float(rect[-1])
        if angle > 45:
            angle -= 90
        if abs(angle) <= max_abs_angle:
            return angle
    return 0.0

def rotate_bound_clean(image: np.ndarray, angle: float) -> np.ndarray:
    """Xoay ảnh không bị mất góc và viền nền trắng sạch"""
    h, w = image.shape[:2]
    cx, cy = w / 2, h / 2
    M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
    cos = abs(M[0, 0])
    sin = abs(M[0, 1])
    nw = int((h * sin) + (w * cos))
    nh = int((h * cos) + (w * sin))
    M[0, 2] += (nw / 2) - cx
    M[1, 2] += (nh / 2) - cy
    return cv2.warpAffine(image, M, (nw, nh), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))

# --- PIPELINE TIỀN XỬ LÝ THÍCH ỨNG (ADAPTIVE PREPROCESSING PIPELINE) ---

def adaptive_preprocess_invoice(img_bgr: np.ndarray) -> tuple[np.ndarray, dict]:
    """
    Pipeline tiền xử lý thích ứng thông minh tự động đáp ứng cả 4 đề xuất:
    1. Tự động phát hiện & Crop sát mép hóa đơn: Loại bỏ mặt bàn, viền tối ngoài lề
    2. Upscale thích ứng: Nếu hóa đơn bị chụp từ xa (chiều rộng hẹp), tự động phóng to để chữ đạt độ cao chuẩn OCR
    3. Ngưỡng góc xoay (Deskew Threshold): Chỉ xoay khi |angle| >= 3.0°
    4. Cân bằng sáng thích ứng: Chỉ tăng sáng/Gamma khi brightness < 90
    5. Khử mờ & Nổi bật mực in nhiệt (Thermal Print Enhancement): Dùng CLAHE kênh V + Bilateral lọc nhiễu phẳng
    """
    if img_bgr is None or img_bgr.size == 0:
        return img_bgr, {"status": "empty_input"}

    output = img_bgr.copy()
    actions_taken = []

    # 1. TỰ ĐỘNG CẮT SÁT BIÊN HÓA ĐƠN (Auto Crop Receipt)
    output, was_cropped = auto_detect_and_crop_receipt(output)
    if was_cropped:
        actions_taken.append(f"Auto_Crop_Receipt ({output.shape[1]}x{output.shape[0]})")

    # 2. UPSCALE NẾU HÓA ĐƠN HẸP / CHỮ QUÁ NHỎ
    h, w = output.shape[:2]
    if w < 750:
        scale = 800.0 / w
        output = cv2.resize(output, (800, int(h * scale)), interpolation=cv2.INTER_CUBIC)
        actions_taken.append(f"Smart_Upscale ({w}px -> 800px, {scale:.2f}x)")
    elif max(h, w) > 2200:
        scale = 2200.0 / max(h, w)
        output = cv2.resize(output, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        actions_taken.append(f"Downscale_Cap ({max(h, w)}px -> 2200px)")

    gray = cv2.cvtColor(output, cv2.COLOR_BGR2GRAY)
    metrics = measure_image_metrics(gray)
    
    # 3. NGƯỠNG GÓC XOAY (DESKEW THRESHOLD)
    angle = estimate_skew_adaptive(gray)
    applied_angle = 0.0
    if abs(angle) >= 3.0:
        output = rotate_bound_clean(output, angle)
        gray = cv2.cvtColor(output, cv2.COLOR_BGR2GRAY)
        applied_angle = angle
        actions_taken.append(f"Deskew ({angle:+.1f}°)")
    else:
        actions_taken.append(f"Skip Deskew (|{angle:.1f}°| < 3.0°)")

    # Cập nhật lại chỉ số sau khi nắn thẳng (nếu có)
    metrics = measure_image_metrics(gray)
    brightness = metrics["brightness"]
    contrast = metrics["contrast"]
    blur_var = metrics["blur_var"]

    # 4. CÂN BẰNG SÁNG VÀ LÀM NỔI BẬT MỰC IN NHIỆT (Thermal Contrast Enhancement)
    if brightness < 90.0:
        # Ảnh thiếu sáng thực sự -> Kích hoạt CLAHE (2.5) + Gamma 1.3
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        eq = clahe.apply(gray)
        inv_gamma = 1.0 / 1.3
        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
        gray = cv2.LUT(eq, table)
        output = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        actions_taken.append(f"CLAHE_Dark (clip=2.5, gamma=1.3, mean={brightness:.1f})")
    else:
        # Giấy in nhiệt có nét mực mờ/nhạt -> Tăng tương phản mực in bằng CLAHE nhẹ trên kênh V (HSV)
        hsv = cv2.cvtColor(output, cv2.COLOR_BGR2HSV)
        clahe = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8))
        hsv[:, :, 2] = clahe.apply(hsv[:, :, 2])
        output = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        actions_taken.append(f"Thermal_Contrast_Enhance (clip=1.8, mean={brightness:.1f})")

    # 5. KHỬ MỜ VÀ NẾP NHĂN GIẤY
    gray_post = cv2.cvtColor(output, cv2.COLOR_BGR2GRAY)
    metrics_post = measure_image_metrics(gray_post)
    if metrics_post["blur_var"] < 100.0:
        smoothed = cv2.bilateralFilter(gray_post, 5, 40, 40)
        blur_layer = cv2.GaussianBlur(smoothed, (0, 0), 1.0)
        sharpened = cv2.addWeighted(smoothed, 1.25, blur_layer, -0.25, 0)
        output = cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)
        actions_taken.append(f"Smart_Deblur (blur_var={metrics_post['blur_var']:.1f})")

    log_meta = {
        "metrics_before": metrics,
        "applied_angle": applied_angle,
        "actions_taken": actions_taken
    }
    return output, log_meta
