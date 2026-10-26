import os
import sys
import time
import httpx
from dotenv import load_dotenv

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Tải biến môi trường từ thư mục backend
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
API_KEY = os.getenv("GEMINI_API_KEY")

# DANH SÁCH MODEL THEO THỨ TỰ ƯU TIÊN
GEMINI_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
]

# Biến toàn cục theo dõi model đang dùng
current_model_index = 0

def _get_gemini_url(model_name: str) -> str:
    """Tạo URL API cho một model cụ thể."""
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={API_KEY}"

def call_llm_with_retry(prompt: str, max_retries: int = 3) -> str:
    """Gọi Gemini API qua REST với auto-retry và auto-fallback sang model khác khi hết quota."""
    global current_model_index
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1}
    }
    
    start_index = current_model_index
    models_tried = 0
    
    while models_tried < len(GEMINI_MODELS):
        model_name = GEMINI_MODELS[current_model_index]
        gemini_url = _get_gemini_url(model_name)
        print(f"[*] Đang sử dụng model: {model_name}")
        
        for attempt in range(max_retries):
            try:
                with httpx.Client(timeout=60) as client:
                    resp = client.post(gemini_url, json=payload)
                
                if resp.status_code == 429:
                    print(f"[!] Model '{model_name}' đã hết lượt dùng (429 Rate Limit).")
                    current_model_index = (current_model_index + 1) % len(GEMINI_MODELS)
                    if current_model_index == start_index:
                        raise Exception(f"Tất cả {len(GEMINI_MODELS)} model đều đã hết lượt dùng! Vui lòng thử lại sau.")
                    print(f"[→] Chuyển sang model dự phòng: {GEMINI_MODELS[current_model_index]}")
                    break
                
                if resp.status_code in [503, 500]:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt * 5
                        print(f"[!] Lỗi {resp.status_code} từ model '{model_name}', thử lại sau {wait_time}s... (lần {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                        continue
                    else:
                        print(f"[!] Model '{model_name}' thất bại sau {max_retries} lần thử (lỗi {resp.status_code}).")
                        current_model_index = (current_model_index + 1) % len(GEMINI_MODELS)
                        if current_model_index == start_index:
                            raise Exception(f"Tất cả {len(GEMINI_MODELS)} model đều thất bại! Chi tiết: {resp.text}")
                        print(f"[→] Chuyển sang model dự phòng: {GEMINI_MODELS[current_model_index]}")
                        break
                
                resp.raise_for_status()
                data = resp.json()
                result = data["candidates"][0]["content"]["parts"][0]["text"]
                print(f"[✓] Model '{model_name}' phản hồi thành công!")
                return result
                
            except (httpx.TimeoutException, httpx.RequestError) as e:
                print(f"[!] Lỗi kết nối/timeout từ model '{model_name}': {e}. Thử lại (lần {attempt + 1}/{max_retries})...")
                if attempt == max_retries - 1:
                    current_model_index = (current_model_index + 1) % len(GEMINI_MODELS)
                    if current_model_index == start_index:
                        raise Exception(f"Tất cả model đều timeout hoặc lỗi mạng: {e}")
                    print(f"[→] Chuyển sang model dự phòng: {GEMINI_MODELS[current_model_index]}")
                    break
                time.sleep(2)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    print(f"[!] Model '{model_name}' đã hết lượt dùng (429).")
                    current_model_index = (current_model_index + 1) % len(GEMINI_MODELS)
                    if current_model_index == start_index:
                        raise Exception(f"Tất cả {len(GEMINI_MODELS)} model đều đã hết lượt dùng!")
                    print(f"[→] Chuyển sang model dự phòng: {GEMINI_MODELS[current_model_index]}")
                    break
                elif e.response.status_code in [503, 500] and attempt < max_retries - 1:
                    wait_time = 2 ** attempt * 5
                    print(f"[!] HTTP Error {e.response.status_code} từ '{model_name}', thử lại sau {wait_time}s... (lần {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                else:
                    raise Exception(f"Gemini API error ({model_name}): {e.response.status_code} - {e.response.text}")
        else:
            current_model_index = (current_model_index + 1) % len(GEMINI_MODELS)
            if current_model_index == start_index:
                raise Exception(f"Tất cả {len(GEMINI_MODELS)} model đều thất bại!")
        
        models_tried += 1
    
    raise Exception(f"Không thể gọi Gemini API: tất cả {len(GEMINI_MODELS)} model đều thất bại.")