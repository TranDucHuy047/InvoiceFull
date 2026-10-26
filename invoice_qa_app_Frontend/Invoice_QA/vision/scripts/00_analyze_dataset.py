from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Callable

import numpy as np

from funsd_hf import DATASET_ID as FUNSD_DATASET_ID, load_funsd
from sroie_hf import DATASET_ID as SROIE_DATASET_ID, load_sroie


def _safe_image_size(sample: dict[str, Any]) -> tuple[int, int]:
    size = sample.get("image_size") or {}
    image = sample.get("image")
    width = int(size.get("width") or getattr(image, "width", 0) or 0)
    height = int(size.get("height") or getattr(image, "height", 0) or 0)
    return width, height


def _word_count(sample: dict[str, Any]) -> int:
    return len(sample.get("words") or [])


def analyze_split(loader: Callable[[str], Any], split: str, max_images: int) -> dict[str, Any]:
    ds = loader(split)
    n = len(ds) if max_images <= 0 else min(len(ds), max_images)

    widths: list[int] = []
    heights: list[int] = []
    word_counts: list[int] = []
    fields: set[str] = set()

    for index in range(n):
        sample = ds[index]
        fields.update(sample.keys())
        width, height = _safe_image_size(sample)
        widths.append(width)
        heights.append(height)
        word_counts.append(_word_count(sample))

    return {
        "dataset_rows": len(ds),
        "analyzed_rows": n,
        "min_width": min(widths) if widths else None,
        "max_width": max(widths) if widths else None,
        "mean_width": round(float(np.mean(widths)), 2) if widths else None,
        "min_height": min(heights) if heights else None,
        "max_height": max(heights) if heights else None,
        "mean_height": round(float(np.mean(heights)), 2) if heights else None,
        "min_words": min(word_counts) if word_counts else None,
        "max_words": max(word_counts) if word_counts else None,
        "mean_words": round(float(np.mean(word_counts)), 2) if word_counts else None,
        "fields": sorted(fields),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Đợt 1 - phân tích SROIE và FUNSD theo đề cương"
    )
    parser.add_argument("--dataset", choices=["sroie", "funsd", "all"], default="all")
    parser.add_argument("--split", choices=["train", "test", "all"], default="all")
    parser.add_argument("--max-images", type=int, default=0, help="0 = phân tích toàn bộ")
    parser.add_argument("--output", default="outputs/dataset_analysis.json")
    args = parser.parse_args()

    dataset_specs = {
        "sroie": (SROIE_DATASET_ID, load_sroie),
        "funsd": (FUNSD_DATASET_ID, load_funsd),
    }
    selected = list(dataset_specs) if args.dataset == "all" else [args.dataset]
    splits = ["train", "test"] if args.split == "all" else [args.split]

    result: dict[str, Any] = {
        "note": (
            "Đề cương yêu cầu khảo sát/phân tích SROIE và FUNSD. "
            "SROIE và ảnh tự chụp phù hợp hơn cho thực nghiệm hóa đơn; FUNSD được giữ cho phần khảo sát/layout."
        ),
        "datasets": {},
    }

    for dataset_name in selected:
        dataset_id, loader = dataset_specs[dataset_name]
        result["datasets"][dataset_name] = {
            "dataset_id": dataset_id,
            "splits": {},
        }
        for split in splits:
            result["datasets"][dataset_name]["splits"][split] = analyze_split(
                loader, split, args.max_images
            )

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\nĐã lưu: {output.resolve()}")


if __name__ == "__main__":
    main()
