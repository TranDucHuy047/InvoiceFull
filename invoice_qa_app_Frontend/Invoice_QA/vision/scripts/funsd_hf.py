from __future__ import annotations

import os
from typing import Any

import cv2
import numpy as np


DATASET_ID = os.getenv("FUNSD_DATASET_ID", "nielsr/funsd")


def load_funsd(split: str = "train"):
    """Load FUNSD từ Hugging Face Datasets và để thư viện tự quản lý cache.

    FUNSD được giữ trong source để đáp ứng phần khảo sát/phân tích dataset của
    đề cương. Dataset chính để thử nghiệm hóa đơn vẫn có thể là SROIE và bộ ảnh
    tự chụp của nhóm.
    """
    try:
        from datasets import load_dataset
    except ImportError as exc:
        raise RuntimeError(
            "Chưa cài Hugging Face Datasets. Chạy: pip install -r vision/requirements.txt"
        ) from exc

    return load_dataset(DATASET_ID, split=split)


def sample_to_cv(sample: dict[str, Any]) -> tuple[np.ndarray, str, str]:
    """FUNSD sample -> ảnh OpenCV BGR + ground-truth text + key.

    Ground truth dùng chuỗi `words` do FUNSD cung cấp; bbox/NER vẫn được giữ
    trong sample gốc nếu cần phân tích layout về sau.
    """
    image = sample.get("image")
    if image is None:
        raise ValueError("FUNSD sample không có trường image.")

    rgb = np.asarray(image.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    words = [str(word).strip() for word in (sample.get("words") or []) if str(word).strip()]
    ground_truth = " ".join(words)
    key = str(sample.get("id") or sample.get("image_id") or "funsd")
    return bgr, ground_truth, key
