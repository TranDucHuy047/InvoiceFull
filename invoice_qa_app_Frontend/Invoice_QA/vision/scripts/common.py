from __future__ import annotations

import csv
import json
import math
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

import cv2
import numpy as np


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


@dataclass
class OCRResult:
    """Kết quả OCR chuẩn hóa của phần Vision.

    `mean_confidence` và `items[*].confidence` dùng thang 0..100 để tiện đọc
    trong báo cáo/thực nghiệm. Khi map sang model Flutter hiện tại của Loan
    (ocrConfidence dùng 0..1), dùng thuộc tính `confidence_ratio`.
    """

    text: str
    mean_confidence: float
    items: list[dict]

    @property
    def confidence_ratio(self) -> float:
        return max(0.0, min(1.0, self.mean_confidence / 100.0))


@dataclass(frozen=True)
class PreprocessConfig:
    """Cấu hình tiền xử lý nhẹ dành cho hóa đơn SROIE/ảnh hóa đơn.

    Pipeline chính của Thúy:
    grayscale -> denoise nhẹ -> CLAHE -> deskew -> sharpen nhẹ.
    """

    denoise_h: float = 7.0
    clahe_clip_limit: float = 1.8
    clahe_grid_size: tuple[int, int] = (8, 8)
    min_abs_angle: float = 3.0
    max_abs_angle: float = 20.0
    sharpen_amount: float = 0.25


def read_image(path: str | Path) -> np.ndarray:
    path = str(path)
    data = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Không đọc được ảnh: {path}")
    return image


def write_image(path: str | Path, image: np.ndarray) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    ext = path.suffix or ".png"
    ok, encoded = cv2.imencode(ext, image)
    if not ok:
        raise ValueError(f"Không encode được ảnh: {path}")
    encoded.tofile(str(path))


def normalize_text(text: str) -> str:
    text = text.upper().replace("\r", "\n")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def rough_text_similarity(reference: str, prediction: str) -> float:
    """Similarity thô 0..1 của Vision, không thay WER chính thức của Loan/QA."""
    ref = normalize_text(reference)
    pred = normalize_text(prediction)
    if not ref and not pred:
        return 1.0
    if not ref or not pred:
        return 0.0
    return SequenceMatcher(None, ref, pred).ratio()


def _to_builtin(value: Any) -> Any:
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {str(k): _to_builtin(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_builtin(v) for v in value]
    return value


@lru_cache(maxsize=8)
def get_paddle_ocr(
    lang: str = "en",
    ocr_version: str = "PP-OCRv5",
    device: str = "cpu",
    enable_mkldnn: bool = False,
):
    """Khởi tạo PaddleOCR một lần và tái sử dụng giữa nhiều ảnh/request."""
    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise RuntimeError(
            "Chưa cài PaddleOCR. Chạy: pip install -r vision/requirements.txt"
        ) from exc

    return PaddleOCR(
        lang=lang,
        ocr_version=ocr_version,
        device=device,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        enable_mkldnn=enable_mkldnn,
    )


def _prediction_payload(prediction: Any) -> dict[str, Any] | None:
    if isinstance(prediction, dict):
        raw_json: Any = prediction
    else:
        raw_json = getattr(prediction, "json", None)
        if callable(raw_json):
            raw_json = raw_json()
    if isinstance(raw_json, str):
        raw_json = json.loads(raw_json)
    if not isinstance(raw_json, dict):
        return None
    payload = raw_json.get("res", raw_json)
    return payload if isinstance(payload, dict) else None


def paddle_ocr(
    image: np.ndarray,
    *,
    lang: str = "en",
    ocr_version: str = "PP-OCRv5",
    device: str = "cpu",
    enable_mkldnn: bool = False,
    min_confidence: float = 0.0,
) -> OCRResult:
    """Chạy PaddleOCR 3.x và chuẩn hóa output về OCRResult của đồ án."""
    if image is None or image.size == 0:
        raise ValueError("Ảnh đầu vào rỗng hoặc không hợp lệ.")

    engine = get_paddle_ocr(
        lang=lang,
        ocr_version=ocr_version,
        device=device,
        enable_mkldnn=enable_mkldnn,
    )
    predictions = engine.predict(image)

    items: list[dict] = []
    tokens: list[str] = []
    confidences: list[float] = []

    for prediction in predictions or []:
        payload = _prediction_payload(prediction)
        if payload is None:
            continue

        raw_texts = payload.get("rec_texts")
        raw_scores = payload.get("rec_scores")
        texts = list(raw_texts) if raw_texts is not None else []
        scores = list(raw_scores) if raw_scores is not None else []
        boxes = payload.get("rec_polys")
        if boxes is None:
            boxes = payload.get("rec_boxes")
        boxes = list(boxes) if boxes is not None else []

        for index, raw_text in enumerate(texts):
            text = str(raw_text).strip()
            if not text:
                continue

            score = float(scores[index]) if index < len(scores) else 0.0
            confidence = score * 100.0 if score <= 1.0 else score
            if confidence < min_confidence:
                continue

            bbox = _to_builtin(boxes[index]) if index < len(boxes) else []
            items.append(
                {
                    "text": text,
                    "confidence": round(confidence, 4),
                    "bbox": bbox,
                }
            )
            tokens.append(text)
            confidences.append(confidence)

    return OCRResult(
        text=" ".join(tokens),
        mean_confidence=float(np.mean(confidences)) if confidences else 0.0,
        items=items,
    )


def estimate_skew_angle(gray: np.ndarray, max_abs_angle: float = 20.0) -> float:
    """Ước lượng góc lệch của các dòng gần ngang trong ảnh hóa đơn."""
    if gray.ndim == 3:
        gray = cv2.cvtColor(gray, cv2.COLOR_BGR2GRAY)

    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150, apertureSize=3)
    _, width = gray.shape[:2]
    min_len = max(40, int(width * 0.20))
    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=max(30, int(width * 0.05)),
        minLineLength=min_len,
        maxLineGap=20,
    )

    angles: list[float] = []
    if lines is not None and len(lines) > 0:
        lines_flat = lines.reshape(-1, 4)
        for x1, y1, x2, y2 in lines_flat:
            angle = math.degrees(math.atan2(float(y2 - y1), float(x2 - x1)))
            if -max_abs_angle <= angle <= max_abs_angle:
                angles.append(angle)

    if angles:
        return float(np.median(angles))

    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(bw > 0))
    if len(coords) < 50:
        return 0.0
    rect = cv2.minAreaRect(coords[:, ::-1].astype(np.float32))
    angle = float(rect[-1])
    if angle > 45:
        angle -= 90
    if abs(angle) > max_abs_angle:
        return 0.0
    return angle


def rotate_bound(
    image: np.ndarray,
    angle: float,
    border_value: int | tuple[int, int, int] = 255,
) -> np.ndarray:
    """Xoay và mở rộng canvas để deskew không cắt chữ/hóa đơn sát mép."""
    height, width = image.shape[:2]
    center = (width / 2.0, height / 2.0)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    cos = abs(matrix[0, 0])
    sin = abs(matrix[0, 1])
    new_width = int(math.ceil(height * sin + width * cos))
    new_height = int(math.ceil(height * cos + width * sin))
    matrix[0, 2] += new_width / 2.0 - center[0]
    matrix[1, 2] += new_height / 2.0 - center[1]
    return cv2.warpAffine(
        image,
        matrix,
        (new_width, new_height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=border_value,
    )


def preprocess_invoice(
    image: np.ndarray,
    *,
    config: PreprocessConfig | None = None,
    profile: str = "full",
) -> tuple[np.ndarray, dict[str, Any]]:
    """Tiền xử lý hóa đơn theo profile `none`, `deskew`, `full` hoặc `adaptive`."""
    if image is None or image.size == 0:
        raise ValueError("Ảnh đầu vào rỗng hoặc không hợp lệ.")
    if profile not in {"none", "deskew", "full", "adaptive"}:
        raise ValueError("profile phải là 'none', 'deskew', 'full' hoặc 'adaptive'")

    cfg = config or PreprocessConfig()
    original = image.copy()
    gray = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY) if original.ndim == 3 else original.copy()

    if profile == "none":
        return original, {
            "original": original,
            "gray": gray,
            "denoised": gray,
            "balanced": gray,
            "deskewed": original,
            "final": original,
            "skew_angle": 0.0,
            "applied_angle": 0.0,
            "profile": profile,
        }

    if profile == "adaptive":
        mean_b = float(np.mean(gray))
        contrast = float(np.std(gray))
        blur_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        skew_angle = estimate_skew_angle(gray, max_abs_angle=cfg.max_abs_angle)
        # 1. Ngưỡng góc xoay (Deskew Threshold): Chỉ xoay khi |angle| >= 3.0°
        applied_angle = skew_angle if abs(skew_angle) >= cfg.min_abs_angle else 0.0
        deskewed_cur = (
            rotate_bound(original, applied_angle, border_value=(255, 255, 255))
            if applied_angle
            else original.copy()
        )
        gray_cur = cv2.cvtColor(deskewed_cur, cv2.COLOR_BGR2GRAY) if deskewed_cur.ndim == 3 else deskewed_cur.copy()
        denoised = gray_cur.copy()

        # 2. Cân bằng sáng thích ứng
        if mean_b < 90.0:
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=cfg.clahe_grid_size)
            eq = clahe.apply(gray_cur)
            inv_gamma = 1.0 / 1.3
            table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
            balanced = cv2.LUT(eq, table)
        elif contrast < 45.0:
            clahe = cv2.createCLAHE(clipLimit=1.3, tileGridSize=cfg.clahe_grid_size)
            balanced = clahe.apply(gray_cur)
        else:
            balanced = gray_cur.copy()

        # 3. Khử mờ thông minh: Bilateral + giữ cạnh
        if blur_var < 80.0:
            smoothed = cv2.bilateralFilter(balanced, 5, 40, 40)
            blur_layer = cv2.GaussianBlur(smoothed, (0, 0), 1.0)
            sharpened = cv2.addWeighted(smoothed, 1.25, blur_layer, -0.25, 0)
        elif contrast < 50.0 and mean_b > 120.0:
            sharpened = cv2.bilateralFilter(balanced, 7, 50, 50)
        else:
            sharpened = balanced

        deskewed = deskewed_cur
        final = cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)
    elif profile == "full":
        denoised = cv2.fastNlMeansDenoising(
            gray,
            None,
            h=cfg.denoise_h,
            templateWindowSize=7,
            searchWindowSize=21,
        )
        clahe = cv2.createCLAHE(
            clipLimit=cfg.clahe_clip_limit,
            tileGridSize=cfg.clahe_grid_size,
        )
        balanced = clahe.apply(denoised)
        angle_source = balanced
        skew_angle = estimate_skew_angle(angle_source, max_abs_angle=cfg.max_abs_angle)
        applied_angle = skew_angle if abs(skew_angle) >= cfg.min_abs_angle else 0.0

        deskewed_gray = (
            rotate_bound(balanced, applied_angle, border_value=255)
            if applied_angle
            else balanced.copy()
        )
        if cfg.sharpen_amount > 0:
            blurred = cv2.GaussianBlur(deskewed_gray, (0, 0), 1.0)
            sharpened = cv2.addWeighted(
                deskewed_gray,
                1.0 + cfg.sharpen_amount,
                blurred,
                -cfg.sharpen_amount,
                0,
            )
        else:
            sharpened = deskewed_gray
        final = cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)
        deskewed = cv2.cvtColor(deskewed_gray, cv2.COLOR_GRAY2BGR)
    else:
        denoised = gray.copy()
        balanced = gray.copy()
        angle_source = gray
        skew_angle = estimate_skew_angle(angle_source, max_abs_angle=cfg.max_abs_angle)
        applied_angle = skew_angle if abs(skew_angle) >= cfg.min_abs_angle else 0.0

        deskewed = (
            rotate_bound(original, applied_angle, border_value=(255, 255, 255))
            if applied_angle
            else original.copy()
        )
        final = deskewed

    meta: dict[str, Any] = {
        "original": original,
        "gray": gray,
        "denoised": denoised,
        "balanced": balanced,
        "deskewed": deskewed,
        "final": final,
        "skew_angle": float(skew_angle),
        "applied_angle": float(applied_angle),
        "profile": profile,
        "config": {
            "denoise_h": cfg.denoise_h,
            "clahe_clip_limit": cfg.clahe_clip_limit,
            "clahe_grid_size": list(cfg.clahe_grid_size),
            "min_abs_angle": cfg.min_abs_angle,
            "max_abs_angle": cfg.max_abs_angle,
            "sharpen_amount": cfg.sharpen_amount,
        },
    }
    return final, meta


def blur_variant(image: np.ndarray) -> np.ndarray:
    return cv2.GaussianBlur(image, (7, 7), 2.0)


def low_light_variant(image: np.ndarray, factor: float = 0.42) -> np.ndarray:
    """Tạo ảnh thiếu sáng để mô phỏng điều kiện ảnh tự chụp trong đề cương.

    Chỉ giảm cường độ sáng, không đổi kích thước hay thêm nhiễu hình học.
    """
    if image is None or image.size == 0:
        raise ValueError("Ảnh đầu vào rỗng hoặc không hợp lệ.")
    factor = max(0.05, min(1.0, float(factor)))
    return np.clip(image.astype(np.float32) * factor, 0, 255).astype(np.uint8)


def rotate_variant(image: np.ndarray, angle: float = 8.0) -> np.ndarray:
    # Chỉ tạo độ nghiêng, không thêm nhiễu crop vào bài đánh giá.
    return rotate_bound(image, angle, border_value=(255, 255, 255))


def find_images(root: str | Path) -> list[Path]:
    root = Path(root)
    return sorted(
        p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )


def load_manifest(path: str | Path) -> list[tuple[Path, str]]:
    """CSV ảnh tự chụp tùy chọn: image + ground_truth_file hoặc ground_truth."""
    path = Path(path)
    rows: list[tuple[Path, str]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            image = Path(row["image"])
            if not image.is_absolute():
                image = (path.parent / image).resolve()
            gt_file = (row.get("ground_truth_file") or "").strip()
            if gt_file:
                gt_path = Path(gt_file)
                if not gt_path.is_absolute():
                    gt_path = (path.parent / gt_path).resolve()
                ground_truth = gt_path.read_text(encoding="utf-8", errors="ignore")
            else:
                ground_truth = row.get("ground_truth", "")
            rows.append((image, ground_truth))
    return rows


def parse_sroie_annotation(path: Path) -> str:
    texts: list[str] = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        parts = line.split(",")
        if len(parts) >= 9 and all(
            re.fullmatch(r"-?\d+(?:\.\d+)?", value.strip()) for value in parts[:8]
        ):
            texts.append(",".join(parts[8:]).strip())
        elif line.strip():
            texts.append(line.strip())
    return " ".join(texts)


def load_sroie_samples(root: str | Path) -> list[tuple[Path, str]]:
    """Đọc bản SROIE local nếu nhóm đã tải dataset về máy."""
    root = Path(root)
    images = find_images(root)
    txt_by_stem: dict[str, list[Path]] = {}
    for txt in root.rglob("*.txt"):
        txt_by_stem.setdefault(txt.stem, []).append(txt)

    samples: list[tuple[Path, str]] = []
    for image in images:
        candidates = txt_by_stem.get(image.stem, [])
        if not candidates:
            continue
        scored = sorted(
            candidates,
            key=lambda path: (
                0 if "task1" in str(path).lower() or "task2" in str(path).lower() else 1,
                len(str(path)),
            ),
        )
        ground_truth = parse_sroie_annotation(scored[0])
        if ground_truth.strip():
            samples.append((image, ground_truth))
    return samples


def chunked(iterable: Iterable[Any], size: int) -> Iterable[list[Any]]:
    bucket: list[Any] = []
    for item in iterable:
        bucket.append(item)
        if len(bucket) == size:
            yield bucket
            bucket = []
    if bucket:
        yield bucket
