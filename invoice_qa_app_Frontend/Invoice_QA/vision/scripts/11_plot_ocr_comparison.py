from __future__ import annotations

import argparse
import re
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


def _tokens(text: object) -> list[str]:
    value = "" if pd.isna(text) else str(text)
    return [token for token in re.split(r"\s+", value.strip()) if token]


def _levenshtein(reference: list[str], hypothesis: list[str]) -> int:
    if not reference:
        return len(hypothesis)
    previous = list(range(len(hypothesis) + 1))
    for i, ref in enumerate(reference, start=1):
        current = [i]
        for j, hyp in enumerate(hypothesis, start=1):
            cost = 0 if ref.lower() == hyp.lower() else 1
            current.append(
                min(
                    current[j - 1] + 1,
                    previous[j] + 1,
                    previous[j - 1] + cost,
                )
            )
        previous = current
    return previous[-1]


def _wer(reference: object, hypothesis: object) -> float:
    ref = _tokens(reference)
    hyp = _tokens(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    return _levenshtein(ref, hyp) / len(ref)


def _ensure_official_metrics(data: pd.DataFrame) -> tuple[pd.DataFrame, bool]:
    """Ưu tiên metric do Loan xuất; fallback chỉ để Thúy có dữ liệu vẽ biểu đồ.

    Các cột chính thức được hỗ trợ:
    raw_wer, preprocessed_wer, raw_accuracy, preprocessed_accuracy.
    """
    required = {"raw_wer", "preprocessed_wer", "raw_accuracy", "preprocessed_accuracy"}
    if required.issubset(data.columns):
        return data, False

    text_columns = {"ground_truth", "raw_text", "preprocessed_text"}
    if not text_columns.issubset(data.columns):
        missing = sorted(required.difference(data.columns))
        raise SystemExit(
            "CSV chưa có metric WER/OCR Accuracy của Loan và cũng không đủ text để tạo fallback. "
            f"Thiếu metric: {missing}"
        )

    data = data.copy()
    data["raw_wer"] = [
        _wer(gt, pred) for gt, pred in zip(data["ground_truth"], data["raw_text"])
    ]
    data["preprocessed_wer"] = [
        _wer(gt, pred)
        for gt, pred in zip(data["ground_truth"], data["preprocessed_text"])
    ]
    data["raw_accuracy"] = (1.0 - data["raw_wer"]).clip(lower=0.0) * 100.0
    data["preprocessed_accuracy"] = (
        (1.0 - data["preprocessed_wer"]).clip(lower=0.0) * 100.0
    )
    return data, True


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Đợt 11 - vẽ biểu đồ WER/OCR Accuracy trước/sau tiền xử lý. "
            "Ưu tiên CSV metric do Loan xuất; nếu chưa có sẽ tạo metric fallback từ text để preview."
        )
    )
    parser.add_argument(
        "--input",
        default="outputs/experiment_10/ocr_preprocessing_comparison_sroie.csv",
    )
    parser.add_argument("--output-dir", default="outputs/experiment_11")
    args = parser.parse_args()

    data = pd.read_csv(args.input)
    data, used_fallback = _ensure_official_metrics(data)

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)

    wer_means = [data["raw_wer"].mean(), data["preprocessed_wer"].mean()]
    plt.figure(figsize=(7, 5))
    plt.bar(["Không tiền xử lý", "Có tiền xử lý"], wer_means)
    plt.ylabel("Word Error Rate (WER)")
    plt.title("PaddleOCR: WER trước/sau tiền xử lý")
    plt.ylim(bottom=0)
    plt.tight_layout()
    plt.savefig(out / "01_wer_before_after.png", dpi=180)
    plt.close()

    accuracy_means = [
        data["raw_accuracy"].mean(),
        data["preprocessed_accuracy"].mean(),
    ]
    plt.figure(figsize=(7, 5))
    plt.bar(["Không tiền xử lý", "Có tiền xử lý"], accuracy_means)
    plt.ylabel("OCR Accuracy (%)")
    plt.title("PaddleOCR: OCR Accuracy trước/sau tiền xử lý")
    plt.ylim(0, 100)
    plt.tight_layout()
    plt.savefig(out / "02_ocr_accuracy_before_after.png", dpi=180)
    plt.close()

    ordered = data.reset_index(drop=True)
    plt.figure(figsize=(10, 5))
    plt.plot(ordered.index + 1, ordered["raw_wer"], marker="o", label="RAW")
    plt.plot(
        ordered.index + 1,
        ordered["preprocessed_wer"],
        marker="o",
        label="Preprocessed",
    )
    plt.xlabel("Mẫu")
    plt.ylabel("WER")
    plt.title("WER theo từng mẫu")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out / "03_wer_per_sample.png", dpi=180)
    plt.close()

    if {"raw_confidence", "preprocessed_confidence"}.issubset(data.columns):
        confidence_means = [
            data["raw_confidence"].mean(),
            data["preprocessed_confidence"].mean(),
        ]
        plt.figure(figsize=(7, 5))
        plt.bar(["Không tiền xử lý", "Có tiền xử lý"], confidence_means)
        plt.ylabel("Mean OCR confidence (%)")
        plt.title("PaddleOCR confidence trước/sau tiền xử lý (metric phụ)")
        plt.ylim(0, 100)
        plt.tight_layout()
        plt.savefig(out / "04_confidence_before_after_optional.png", dpi=180)
        plt.close()

    if used_fallback:
        print(
            "LƯU Ý: CSV chưa có cột metric do Loan xuất, nên script đã tính WER/Accuracy "
            "fallback chỉ để Thúy preview biểu đồ. Khi nghiệm thu, ưu tiên CSV metric chính thức của Loan."
        )
    print(f"Đã lưu biểu đồ vào: {out.resolve()}")


if __name__ == "__main__":
    main()
