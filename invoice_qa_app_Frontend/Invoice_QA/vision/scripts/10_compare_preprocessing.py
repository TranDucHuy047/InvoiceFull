from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Iterable

import numpy as np

from common import load_manifest, paddle_ocr, preprocess_invoice, read_image, rough_text_similarity
from funsd_hf import load_funsd, sample_to_cv as funsd_sample_to_cv
from sroie_hf import load_sroie, sample_to_cv as sroie_sample_to_cv


def iter_sroie(split: str, start: int, limit: int):
    dataset = load_sroie(split)
    end = len(dataset) if limit <= 0 else min(len(dataset), start + limit)
    for index in range(start, end):
        image, ground_truth, key = sroie_sample_to_cv(dataset[index])
        yield str(index), key, image, ground_truth


def iter_funsd(split: str, start: int, limit: int):
    dataset = load_funsd(split)
    end = len(dataset) if limit <= 0 else min(len(dataset), start + limit)
    for index in range(start, end):
        image, ground_truth, key = funsd_sample_to_cv(dataset[index])
        yield str(index), key, image, ground_truth


def iter_manifest(manifest: str, start: int, limit: int):
    samples = load_manifest(manifest)
    end = len(samples) if limit <= 0 else min(len(samples), start + limit)
    for index in range(start, end):
        path, ground_truth = samples[index]
        yield str(index), path.stem, read_image(path), ground_truth


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Đợt 10 - so sánh PaddleOCR Có/Không tiền xử lý trên SROIE, FUNSD "
            "hoặc 50 ảnh tự chụp qua manifest"
        )
    )
    parser.add_argument("--source", choices=["sroie", "funsd", "manifest"], default="sroie")
    parser.add_argument("--manifest", help="CSV ảnh tự chụp: image,ground_truth hoặc ground_truth_file")
    parser.add_argument("--split", choices=["train", "test"], default="test")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--lang", default="en")
    parser.add_argument("--ocr-version", default="PP-OCRv5")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--output-dir", default="outputs/experiment_10")
    args = parser.parse_args()

    if args.source == "manifest" and not args.manifest:
        raise SystemExit("--manifest là bắt buộc khi --source manifest")

    samples: Iterable
    if args.source == "sroie":
        samples = iter_sroie(args.split, args.start, args.limit)
    elif args.source == "funsd":
        samples = iter_funsd(args.split, args.start, args.limit)
    else:
        samples = iter_manifest(args.manifest, args.start, args.limit)

    rows: list[dict] = []
    for run_no, (index, key, image, ground_truth) in enumerate(samples, start=1):
        raw = paddle_ocr(
            image,
            lang=args.lang,
            ocr_version=args.ocr_version,
            device=args.device,
            enable_mkldnn=False,
        )
        processed, meta = preprocess_invoice(image, profile="full")
        after = paddle_ocr(
            processed,
            lang=args.lang,
            ocr_version=args.ocr_version,
            device=args.device,
            enable_mkldnn=False,
        )
        raw_similarity = rough_text_similarity(ground_truth, raw.text)
        pre_similarity = rough_text_similarity(ground_truth, after.text)
        rows.append(
            {
                "source": args.source,
                "index": index,
                "key": key,
                "raw_similarity": round(raw_similarity, 4),
                "preprocessed_similarity": round(pre_similarity, 4),
                "improvement": round(pre_similarity - raw_similarity, 4),
                "raw_confidence": round(raw.mean_confidence, 2),
                "preprocessed_confidence": round(after.mean_confidence, 2),
                "estimated_skew_deg": round(float(meta["skew_angle"]), 3),
                "ground_truth": ground_truth,
                "raw_text": raw.text,
                "preprocessed_text": after.text,
            }
        )
        print(
            f"[{run_no}] {args.source}/{key}: {raw_similarity * 100:.1f}% -> "
            f"{pre_similarity * 100:.1f}% ({(pre_similarity - raw_similarity) * 100:+.1f} điểm)"
        )

    if not rows:
        raise SystemExit("Không có dữ liệu để chạy thực nghiệm.")

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    csv_path = out / f"ocr_preprocessing_comparison_{args.source}.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    raw_mean = float(np.mean([row["raw_similarity"] for row in rows]))
    pre_mean = float(np.mean([row["preprocessed_similarity"] for row in rows]))
    summary = {
        "source": args.source,
        "sample_count": len(rows),
        "ocr_engine": "PaddleOCR",
        "ocr_version": args.ocr_version,
        "preprocessing": "denoise + CLAHE + deskew rotate-bound + sharpen",
        "raw_similarity_percent": round(raw_mean * 100, 2),
        "preprocessed_similarity_percent": round(pre_mean * 100, 2),
        "difference_percentage_points": round((pre_mean - raw_mean) * 100, 2),
        "raw_mean_confidence": round(float(np.mean([row["raw_confidence"] for row in rows])), 2),
        "preprocessed_mean_confidence": round(
            float(np.mean([row["preprocessed_confidence"] for row in rows])), 2
        ),
        "note": (
            "CSV có ground_truth/raw_text/preprocessed_text để Loan tính WER/OCR Accuracy; "
            "Thúy dùng kết quả đó để vẽ biểu đồ Đợt 11."
        ),
    }
    (out / f"ocr_preprocessing_summary_{args.source}.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Chi tiết: {csv_path.resolve()}")


if __name__ == "__main__":
    main()
