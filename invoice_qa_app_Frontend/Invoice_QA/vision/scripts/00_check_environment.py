from __future__ import annotations

import importlib
import platform
import sys


def version_of(module_name: str) -> str:
    try:
        module = importlib.import_module(module_name)
        return str(getattr(module, "__version__", "installed"))
    except Exception as exc:  # môi trường kiểm tra có thể thiếu optional dependency
        return f"NOT AVAILABLE ({type(exc).__name__}: {exc})"


def main() -> None:
    print("=== Vision environment ===")
    print(f"Python      : {sys.version.split()[0]}")
    print(f"OS          : {platform.platform()}")
    print(f"OpenCV      : {version_of('cv2')}")
    print(f"NumPy       : {version_of('numpy')}")
    print(f"PaddleOCR   : {version_of('paddleocr')}")
    print(f"PaddlePaddle: {version_of('paddle')}")
    print(f"PyTorch (*) : {version_of('torch')}")
    print("(*) PyTorch chỉ phục vụ yêu cầu môi trường/nghiên cứu Đợt 1; pipeline OCR dùng PaddlePaddle.")


if __name__ == "__main__":
    main()
