from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np

from common import PreprocessConfig, paddle_ocr, preprocess_invoice, rough_text_similarity
from sroie_hf import load_sroie, sample_to_cv


PROFILES: dict[str, PreprocessConfig] = {
    "light": PreprocessConfig(
        denoise_h=5.0,
        clahe_clip_limit=1.5,
        min_abs_angle=0.35,
        sharpen_amount=0.15,
    ),
    "balanced": PreprocessConfig(
        denoise_h=7.0,
        clahe_clip_limit=1.8,
        min_abs_angle=0.35,
        sharpen_amount=0.25,
    ),
    "strong": PreprocessConfig(
        denoise_h=9.0,
        clahe_clip_limit=2.2,
        min_abs_angle=0.35,
        sharpen_amount=0.30,
    ),
}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Đợt 9 - tinh chỉnh tham số OpenCV trên SROIE cho đầu vào QA"
    )
    parser.add_argument("--split", choices=["train", "test"], default="test")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--lang", default="en")
    parser.add_argument("--ocr-version", default="PP-OCRv5")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--output-dir", default="outputs/experiment_09")
    args = parser.parse_args()

    dataset = load_sroie(args.split)
    end = len(dataset) if args.limit <= 0 else min(len(dataset), args.start + args.limit)
    if args.start >= len(dataset):
        raise SystemExit(f"--start phải nhỏ hơn {len(dataset)}")

    rows: list[dict] = []
    for index in range(args.start, end):
        image, ground_truth, key = sample_to_cv(dataset[index])

        raw = paddle_ocr(
            image,
            lang=args.lang,
            ocr_version=args.ocr_version,
            device=args.device,
            enable_mkldnn=False,
        )
        raw_score = rough_text_similarity(ground_truth, raw.text)

        for profile_name, config in PROFILES.items():
            processed, meta = preprocess_invoice(image, config=config, profile="full")
            result = paddle_ocr(
                processed,
                lang=args.lang,
                ocr_version=args.ocr_version,
                device=args.device,
                enable_mkldnn=False,
            )
            score = rough_text_similarity(ground_truth, result.text)
            rows.append(
                {
                    "split": args.split,
                    "index": index,
                    "key": key,
                    "profile": profile_name,
                    "denoise_h": config.denoise_h,
                    "clahe_clip_limit": config.clahe_clip_limit,
                    "sharpen_amount": config.sharpen_amount,
                    "estimated_skew_deg": round(float(meta["skew_angle"]), 3),
                    "raw_similarity": round(raw_score, 4),
                    "tuned_similarity": round(score, 4),
                    "improvement": round(score - raw_score, 4),
                    "raw_confidence": round(raw.mean_confidence, 2),
                    "tuned_confidence": round(result.mean_confidence, 2),
                }
            )
            print(
                f"{key} / {profile_name}: {raw_score * 100:.1f}% -> "
                f"{score * 100:.1f}% ({(score - raw_score) * 100:+.1f} điểm)"
            )

    if not rows:
        raise SystemExit("Không có dữ liệu để tinh chỉnh.")

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    csv_path = out / "opencv_tuning_detail.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    summary: dict[str, dict] = {}
    for profile_name in PROFILES:
        subset = [row for row in rows if row["profile"] == profile_name]
        summary[profile_name] = {
            "n": len(subset),
            "mean_similarity_percent": round(
                float(np.mean([row["tuned_similarity"] for row in subset])) * 100, 2
            ),
            "mean_improvement_percentage_points": round(
                float(np.mean([row["improvement"] for row in subset])) * 100, 2
            ),
            "mean_confidence_percent": round(
                float(np.mean([row["tuned_confidence"] for row in subset])), 2
            ),
        }

    best_profile = max(summary, key=lambda name: summary[name]["mean_similarity_percent"])
    report = {
        "dataset": "jsdnrs/ICDAR2019-SROIE",
        "ocr_engine": "PaddleOCR",
        "ocr_version": args.ocr_version,
        "note": "Tuning Vision dùng rough similarity; WER/OCR Accuracy chính thức thuộc Loan/QA.",
        "profiles": summary,
        "best_profile_by_rough_similarity": best_profile,
    }
    (out / "opencv_tuning_summary.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"Chi tiết: {csv_path.resolve()}")


if __name__ == "__main__":
    main()
