from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import numpy as np

from .scripts.common import OCRResult, paddle_ocr, preprocess_invoice, read_image


def process_image_result(
    image: str | Path | np.ndarray,
    *,
    lang: str | None = None,
    ocr_version: str | None = None,
    device: str | None = None,
    preprocess_profile: str = "full",
) -> OCRResult:
    """Điểm tích hợp Vision: ảnh -> OpenCV -> PaddleOCR -> OCRResult."""
    source = image if isinstance(image, np.ndarray) else read_image(image)
    processed, _meta = preprocess_invoice(source, profile=preprocess_profile)
    return paddle_ocr(
        processed,
        lang=lang or os.getenv("PADDLE_OCR_LANG", "en"),
        ocr_version=ocr_version or os.getenv("PADDLE_OCR_VERSION", "PP-OCRv5"),
        device=device or os.getenv("PADDLE_OCR_DEVICE", "cpu"),
        enable_mkldnn=os.getenv("PADDLE_OCR_MKLDNN", "0") == "1",
    )


def process_image(
    image: str | Path | np.ndarray,
    *,
    lang: str | None = None,
    ocr_version: str | None = None,
    device: str | None = None,
    preprocess_profile: str = "full",
) -> str:
    """Hàm đơn giản để Backend gọi và nhận OCR text dạng str."""
    return process_image_result(
        image,
        lang=lang,
        ocr_version=ocr_version,
        device=device,
        preprocess_profile=preprocess_profile,
    ).text


def process_image_payload(
    image: str | Path | np.ndarray,
    *,
    lang: str | None = None,
    ocr_version: str | None = None,
    device: str | None = None,
    preprocess_profile: str = "full",
) -> dict[str, Any]:
    """Payload OCR trung gian để Huy map vào response Backend mà không sửa Vision.

    `ocr_confidence` dùng 0..1 để khớp `InvoiceResult.ocrConfidence` hiện tại của Flutter.
    """
    result = process_image_result(
        image,
        lang=lang,
        ocr_version=ocr_version,
        device=device,
        preprocess_profile=preprocess_profile,
    )
    return {
        "raw_text": result.text,
        "ocr_confidence": result.confidence_ratio,
        "ocr_confidence_percent": round(result.mean_confidence, 4),
        "ocr_items": result.items,
    }
