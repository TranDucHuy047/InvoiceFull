from __future__ import annotations

import argparse
from pathlib import Path

import cv2

from common import write_image
from sroie_hf import get_sample, sample_to_cv


def main() -> None:
    parser = argparse.ArgumentParser(description="Đợt 1 - OpenCV cơ bản trên ảnh SROIE Hugging Face")
    parser.add_argument("--split", choices=["train", "test"], default="train")
    parser.add_argument("--index", type=int, default=0)
    parser.add_argument("--output-dir", default="outputs/opencv_basic")
    args = parser.parse_args()

    sample = get_sample(args.split, args.index)
    image, ground_truth, key = sample_to_cv(sample)

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    adaptive = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11)
    edges = cv2.Canny(blurred, 50, 150)

    write_image(out / f"{key}_01_original.png", image)
    write_image(out / f"{key}_02_gray.png", gray)
    write_image(out / f"{key}_03_blur.png", blurred)
    write_image(out / f"{key}_04_otsu.png", otsu)
    write_image(out / f"{key}_05_adaptive.png", adaptive)
    write_image(out / f"{key}_06_edges.png", edges)
    (out / f"{key}_ground_truth.txt").write_text(ground_truth, encoding="utf-8")

    print(f"SROIE {args.split}[{args.index}] = {key}")
    print(f"Kích thước ảnh: {image.shape[1]}x{image.shape[0]}")
    print(f"Số vùng text ground truth: {len(sample.get('words', []))}")
    print(f"Đã lưu các bước OpenCV vào: {out.resolve()}")


if __name__ == "__main__":
    main()
