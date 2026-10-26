from __future__ import annotations

import argparse
from pathlib import Path

from common import PreprocessConfig, preprocess_invoice, write_image
from sroie_hf import get_sample, sample_to_cv


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Đợt 3 - denoise, cân bằng sáng (CLAHE) và deskew ảnh hóa đơn"
    )
    parser.add_argument("--split", choices=["train", "test"], default="train")
    parser.add_argument("--index", type=int, default=0)
    parser.add_argument("--output-dir", default="outputs/preprocess")
    parser.add_argument("--denoise-h", type=float, default=7.0)
    parser.add_argument("--clahe", type=float, default=1.8)
    parser.add_argument("--min-angle", type=float, default=0.35)
    parser.add_argument("--sharpen", type=float, default=0.25)
    args = parser.parse_args()

    sample = get_sample(args.split, args.index)
    image, ground_truth, key = sample_to_cv(sample)
    config = PreprocessConfig(
        denoise_h=args.denoise_h,
        clahe_clip_limit=args.clahe,
        min_abs_angle=args.min_angle,
        sharpen_amount=args.sharpen,
    )
    final, meta = preprocess_invoice(image, config=config, profile="full")

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    write_image(out / f"{key}_01_original.png", meta["original"])
    write_image(out / f"{key}_02_gray.png", meta["gray"])
    write_image(out / f"{key}_03_denoised.png", meta["denoised"])
    write_image(out / f"{key}_04_balanced_CLAHE.png", meta["balanced"])
    write_image(out / f"{key}_05_deskewed.png", meta["deskewed"])
    write_image(out / f"{key}_06_final.png", final)
    (out / f"{key}_ground_truth.txt").write_text(ground_truth, encoding="utf-8")

    print(f"SROIE {args.split}[{args.index}] = {key}")
    print(f"Góc nghiêng ước lượng: {float(meta['skew_angle']):.2f}°")
    print(f"Góc thực tế áp dụng: {float(meta['applied_angle']):.2f}°")
    print("Pipeline: Grayscale -> Denoise nhẹ -> CLAHE -> Deskew -> Sharpen nhẹ")
    print(f"Đã lưu các bước tại: {out.resolve()}")


if __name__ == "__main__":
    main()
