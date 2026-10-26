from __future__ import annotations

from functools import lru_cache
from typing import Any

import cv2
import numpy as np

DATASET_ID = "jsdnrs/ICDAR2019-SROIE"


@lru_cache(maxsize=4)
def load_sroie(split: str = "train"):
    from datasets import load_dataset

    if split not in {"train", "test"}:
        raise ValueError("split phải là 'train' hoặc 'test'")
    return load_dataset(DATASET_ID, split=split)


def pil_to_bgr(image) -> np.ndarray:
    arr = np.asarray(image.convert("RGB"))
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def sample_to_cv(sample: dict[str, Any]) -> tuple[np.ndarray, str, str]:
    image = pil_to_bgr(sample["image"])
    ground_truth = " ".join(str(x).strip() for x in sample.get("words", []) if str(x).strip())
    key = str(sample.get("key", "sample"))
    return image, ground_truth, key


def get_sample(split: str = "train", index: int = 0):
    ds = load_sroie(split)
    if not 0 <= index < len(ds):
        raise IndexError(f"index={index} ngoài phạm vi 0..{len(ds)-1}")
    return ds[index]
