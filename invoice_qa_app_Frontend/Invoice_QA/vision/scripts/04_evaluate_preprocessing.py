from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np

from common import (
    blur_variant,
    low_light_variant,
    paddle_ocr,
    preprocess_invoice,
    rough_text_similarity,
    rotate_variant,
    write_image,
)
from sroie_hf import load_sroie, sample_to_cv


def variants_for(image, mode: str):
    variants = {
        "original": image,
        "blur": blur_variant(image),
        "rotate_8deg": rotate_variant(image, 8.0),
        "low_light": low_light_variant(image),
    }
    if mode == "all":
        return variants
    if mode == "rotate":
        return {"rotate_8deg": variants["rotate_8deg"]}
    return {mode: variants[mode]}


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Đợt 4/9 - đánh giá PaddleOCR trên ảnh gốc, mờ, nghiêng và thiếu sáng; "
            "giữ format CSV tương thích test WER/OCR Accuracy của Loan"
        )
    )
    parser.add_argument("--split", choices=["train", "test"], default="test")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument(
        "--variant",
        choices=["all", "original", "blur", "rotate", "low_light"],
        default="all",
    )
    parser.add_argument("--lang", default="en")
    parser.add_argument("--ocr-version", default="PP-OCRv5")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--output-dir", default="outputs/evaluation")
    parser.add_argument("--save-images", action="store_true")
    args = parser.parse_args()

    ds = load_sroie(args.split)
    end = len(ds) if args.limit <= 0 else min(len(ds), args.start + args.limit)
    if args.start >= len(ds):
        raise SystemExit(f"--start phải nhỏ hơn {len(ds)}")

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    run_no = 0

    # paddle_ocr() dùng engine cache, model chỉ load một lần cho toàn bộ vòng lặp.
    for index in range(args.start, end):
        sample = ds[index]
        image, ground_truth, key = sample_to_cv(sample)
        for variant_name, variant_image in variants_for(image, args.variant).items():
            run_no += 1
            raw = paddle_ocr(
                variant_image,
                lang=args.lang,
                ocr_version=args.ocr_version,
                device=args.device,
                enable_mkldnn=False,
            )
            processed, meta = preprocess_invoice(variant_image, profile="full")
            after = paddle_ocr(
                processed,
                lang=args.lang,
                ocr_version=args.ocr_version,
                device=args.device,
                enable_mkldnn=False,
            )
            raw_score = rough_text_similarity(ground_truth, raw.text)
            after_score = rough_text_similarity(ground_truth, after.text)

            # QUAN TRỌNG: 13 cột đầu giữ nguyên thứ tự mà
            # test/qa_evaluation_test.dart của Loan đang đọc:
            # row[10]=ground_truth, row[11]=raw_text, row[12]=preprocessed_text.
            rows.append(
                {
                    "split": args.split,
                    "index": index,
                    "key": key,
                    "variant": variant_name,
                    "estimated_skew_deg": round(float(meta["skew_angle"]), 3),
                    "raw_similarity": round(raw_score, 4),
                    "preprocessed_similarity": round(after_score, 4),
                    "improvement": round(after_score - raw_score, 4),
                    "raw_ocr_confidence": round(raw.mean_confidence, 2),
                    "preprocessed_ocr_confidence": round(after.mean_confidence, 2),
                    "ground_truth": ground_truth,
                    "raw_text": raw.text,
                    "preprocessed_text": after.text,
                    # Cột mở rộng phải đặt SAU 13 cột tương thích Loan.
                    "applied_skew_deg": round(float(meta["applied_angle"]), 3),
                }
            )

            if args.save_images:
                stem = f"{index:04d}_{key}_{variant_name}"
                write_image(out / "images" / f"{stem}_input.png", variant_image)
                write_image(out / "images" / f"{stem}_processed.png", processed)

            print(
                f"[{run_no}] {args.split}[{index}] {key} / {variant_name}: "
                f"{raw_score * 100:.1f}% -> {after_score * 100:.1f}% "
                f"({(after_score - raw_score) * 100:+.1f} điểm)"
            )

    if not rows:
        raise SystemExit("Không có sample để đánh giá.")

    csv_path = out / "evaluation_detail.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    by_variant: dict[str, dict] = {}
    for variant in sorted({row["variant"] for row in rows}):
        subset = [row for row in rows if row["variant"] == variant]
        raw_mean = float(np.mean([row["raw_similarity"] for row in subset]))
        pre_mean = float(np.mean([row["preprocessed_similarity"] for row in subset]))
        by_variant[variant] = {
            "n": len(subset),
            "raw_similarity_percent": round(raw_mean * 100, 2),
            "preprocessed_similarity_percent": round(pre_mean * 100, 2),
            "improvement_percentage_points": round((pre_mean - raw_mean) * 100, 2),
            "raw_mean_ocr_confidence": round(
                float(np.mean([row["raw_ocr_confidence"] for row in subset])), 2
            ),
            "preprocessed_mean_ocr_confidence": round(
                float(np.mean([row["preprocessed_ocr_confidence"] for row in subset])), 2
            ),
        }

    summary = {
        "dataset": "jsdnrs/ICDAR2019-SROIE",
        "split": args.split,
        "ocr_engine": "PaddleOCR",
        "ocr_version": args.ocr_version,
        "sample_count": len(set(row["index"] for row in rows)),
        "ocr_runs": len(rows) * 2,
        "preprocessing_pipeline": "denoise_clahe_deskew_rotate_bound_sharpen",
        "tested_conditions": sorted({row["variant"] for row in rows}),
        "metric_note": (
            "rough_similarity là metric nhanh của Vision. CSV giữ ground_truth/raw/preprocessed "
            "đúng vị trí để Loan tính WER/OCR Accuracy chính thức."
        ),
        "by_variant": by_variant,
    }
    (out / "evaluation_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("\n=== TÓM TẮT ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Chi tiết: {csv_path.resolve()}")


if __name__ == "__main__":
    main()
