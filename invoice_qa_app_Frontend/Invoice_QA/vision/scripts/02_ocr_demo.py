from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

from common import OCRResult, paddle_ocr, rough_text_similarity, write_image
from sroie_hf import get_sample, sample_to_cv


def draw_boxes(image: np.ndarray, result: OCRResult) -> np.ndarray:
    canvas = image.copy()
    for item in result.items:
        box = item.get("bbox")
        if not box:
            continue
        array = np.asarray(box)
        if array.shape == (4, 2):
            points = array.astype(np.int32).reshape((-1, 1, 2))
            cv2.polylines(canvas, [points], True, (0, 0, 0), 1)
        elif array.size == 4:
            x1, y1, x2, y2 = map(int, array.reshape(-1).tolist())
            cv2.rectangle(canvas, (x1, y1), (x2, y2), (0, 0, 0), 1)
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser(description="Đợt 2 - PaddleOCR trên ảnh SROIE")
    parser.add_argument("--split", choices=["train", "test"], default="train")
    parser.add_argument("--index", type=int, default=0)
    parser.add_argument("--lang", default="en")
    parser.add_argument("--ocr-version", default="PP-OCRv5")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--output-dir", default="outputs/ocr_demo")
    args = parser.parse_args()

    sample = get_sample(args.split, args.index)
    image, ground_truth, key = sample_to_cv(sample)
    result = paddle_ocr(
        image,
        lang=args.lang,
        ocr_version=args.ocr_version,
        device=args.device,
        enable_mkldnn=False,
    )
    similarity = rough_text_similarity(ground_truth, result.text)

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{key}_ground_truth.txt").write_text(ground_truth, encoding="utf-8")
    (out / f"{key}_ocr_text.txt").write_text(result.text, encoding="utf-8")
    (out / f"{key}_ocr_result.json").write_text(
        json.dumps(
            {
                "dataset": "jsdnrs/ICDAR2019-SROIE",
                "split": args.split,
                "index": args.index,
                "key": key,
                "engine": "paddleocr",
                "ocr_version": args.ocr_version,
                "lang": args.lang,
                "mean_confidence": round(result.mean_confidence, 2),
                "rough_similarity_percent": round(similarity * 100, 2),
                "ground_truth": ground_truth,
                "text": result.text,
                "items": result.items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    write_image(out / f"{key}_ocr_boxes.png", draw_boxes(image, result))

    print(f"SROIE {args.split}[{args.index}] = {key}")
    print(f"Engine: PaddleOCR {args.ocr_version}")
    print(f"Mean confidence: {result.mean_confidence:.2f}%")
    print(f"Rough similarity với ground truth: {similarity * 100:.2f}%")
    print(f"Đã lưu kết quả vào: {out.resolve()}")


if __name__ == "__main__":
    main()
