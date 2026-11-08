import os
import time
import unicodedata
import datetime
import re
from fastapi import APIRouter, Depends

# Import định dạng dữ liệu
from schemas import QA_Request, Global_QA_Request, QA_Response, QA_Data

# Import xác thực người dùng
from auth import get_current_user

# Import các hàm truy vấn Weaviate và biến lưu lịch sử chat
from database import (
    BASE_DIR,
    get_invoice_by_id, 
    search_relevant_items, 
    global_search_invoices, 
    global_search_items,
    get_all_active_items_for_user,
    get_all_invoices_sorted,
    chat_history_db,
    save_chat_history
)

# Import service gọi AI
from llm_service import call_llm_with_retry

# Khởi tạo Router
router = APIRouter()

OUT_OF_SCOPE_RESPONSE = (
    "Xin lỗi, tôi là trợ lý AI chuyên về tra cứu hóa đơn và quản lý chi tiêu. "
    "Tôi chỉ có thể hỗ trợ các câu hỏi liên quan đến hóa đơn, sản phẩm, cửa hàng và lịch sử chi tiêu của bạn. "
    "Vui lòng đặt câu hỏi liên quan đến hóa đơn nhé!"
)

def _remove_diacritics(s: str) -> str:
    if not s:
        return ""
    s = str(s).replace("đ", "d").replace("Đ", "D")
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("utf-8").lower()

def check_unauthorized_user_query(question: str, current_username: str):
    """
    Cơ chế bảo mật & phân quyền: Ngăn chặn người dùng tra cứu thông tin của tài khoản khác.
    """
    if not current_username:
        return None
        
    q_norm = _remove_diacritics(question).strip()
    curr_norm = _remove_diacritics(current_username).strip()
    
    # 1. Các cụm từ hỏi chung về người khác / tài khoản khác
    generic_other_keywords = [
        "tai khoan khac", "user khac", "nguoi khac", "nguoi dung khac", 
        "ai khac", "tai khoan nguoi khac", "hoa don cua nguoi khac", 
        "tat ca nguoi dung", "tat ca user", "cac user khac", "cac tai khoan khac"
    ]
    if any(kw in q_norm for kw in generic_other_keywords):
        return (
            f"Vì lý do bảo mật và bảo vệ quyền riêng tư dữ liệu, bạn chỉ có thể tra cứu hóa đơn và dữ liệu của chính tài khoản của bạn ({current_username}). "
            "Hệ thống không hỗ trợ xem hoặc tra cứu thông tin của tài khoản khác."
        )
        
    # 2. Các mẫu hỏi trực tiếp về tài khoản/người dùng cụ thể (KHÔNG bắt từ "khách hàng" vì đó là người mua trên hóa đơn)
    patterns = [
        r'(?:tai khoan|user|account)(?:\s+cua)?\s+([a-zA-Z0-9_\-\.]+)',
        r'(?:hoa don|chi tieu|thong tin)\s+cua\s+(?:tai khoan|user|nguoi dung)\s+([a-zA-Z0-9_\-\.]+)',
        r'(?:xem|tra cuu|tim|cho toi biet|kiem tra)\s+(?:thong tin\s+)?(?:tai khoan|user|account)(?:\s+cua)?\s+([a-zA-Z0-9_\-\.]+)'
    ]
    
    ignore_words = {
        "toi", "minh", "nay", "hien tai", "tat ca", "cac", "nhung", "mot", "1", "ban", 
        "cua", "em", "anh", "chi", "toan bo", "he thong", "app", "ung dung", "khach",
        "hang", "da", "mua", "thanh", "toan", "tieu", "co", "khong", "la", "tren",
        "trong", "hoa", "don", "do", "duoc", "phai", "tra", "nhan", "lai", "gop"
    }
    
    for pat in patterns:
        matches = re.finditer(pat, q_norm)
        for m in matches:
            target_user = m.group(1).strip()
            if target_user in ignore_words:
                continue
            if target_user != curr_norm:
                return (
                    f"Vì lý do bảo mật và bảo vệ quyền riêng tư dữ liệu, bạn chỉ có thể tra cứu hóa đơn và chi tiêu của chính tài khoản của bạn ({current_username}). "
                    f"Hệ thống không hỗ trợ xem hoặc tra cứu thông tin của tài khoản khác ('{target_user}')."
                )
                
    return None


def clean_answer_text(text: str) -> str:
    """Chuẩn hóa câu trả lời của AI: giữ nguyên định dạng Markdown **in đậm** và danh sách gạch đầu dòng '- ' để hiển thị đẹp mắt."""
    if not text:
        return ""
    cleaned = text.replace("***", "**").strip()
    raw_lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    if not raw_lines:
        return cleaned

    formatted_lines = []
    for line in raw_lines:
        line = re.sub(r'^\*\s+', '- ', line)
        line = re.sub(r'\s{2,}', ' ', line).strip()
        if line:
            formatted_lines.append(line)

    return "\n".join(formatted_lines).strip()


def _fmt_vnd(val: float) -> str:
    return f"{float(val or 0):,.0f}".replace(",", ".") + "đ"


def build_invoice_analytics_context(items: list) -> str:
    """Tính toán chính xác 100% bằng Python cho các câu hỏi thống kê dòng hàng, gộp dòng trùng tên, đơn giá."""
    if not items:
        return "Không có thông tin chi tiết món hàng."
    
    valid_items = []
    for item in items:
        name = str(item.get("item_name", "") or "").strip()
        if not name:
            continue
        qty = int(item.get("quantity", 1) or 1)
        tot = float(item.get("total_price", 0.0) or 0.0)
        unit = float(item.get("unit_price", 0.0) or 0.0)
        if unit <= 0 and tot > 0 and qty > 0:
            unit = round(tot / qty, 2)
        elif tot <= 0 and unit > 0 and qty > 0:
            tot = round(unit * qty, 2)
        valid_items.append({
            "item_name": name,
            "quantity": qty,
            "unit_price": unit,
            "total_price": tot
        })
        
    if not valid_items:
        return "Không có thông tin chi tiết món hàng."
        
    line_items_count = len(valid_items)
    total_units_count = sum(x["quantity"] for x in valid_items)
    total_items_amount = sum(x["total_price"] for x in valid_items)
    
    lines_str = "1. DANH SÁCH TỪNG DÒNG HÀNG (LINE ITEMS) TRÊN HÓA ĐƠN:\n"
    for idx, x in enumerate(valid_items, 1):
        lines_str += (
            f"   - Dòng {idx}: {x['item_name']} | Số lượng: {x['quantity']} | "
            f"Đơn giá: {_fmt_vnd(x['unit_price'])} | Thành tiền: {_fmt_vnd(x['total_price'])}\n"
        )
        
    # Gộp các dòng trùng tên
    grouped_map = {}
    for x in valid_items:
        key = x["item_name"].upper().strip()
        if key not in grouped_map:
            grouped_map[key] = {
                "item_name": x["item_name"],
                "line_count": 0,
                "total_quantity": 0,
                "unit_price": x["unit_price"],
                "total_spend": 0.0
            }
        grouped_map[key]["line_count"] += 1
        grouped_map[key]["total_quantity"] += x["quantity"]
        grouped_map[key]["total_spend"] += x["total_price"]
        if x["unit_price"] > 0:
            grouped_map[key]["unit_price"] = x["unit_price"]
            
    unique_products_count = len(grouped_map)
    grouped_list = sorted(grouped_map.values(), key=lambda g: (g["total_spend"], g["unit_price"]), reverse=True)
    
    grouped_str = "\n2. BẢNG THỐNG KÊ SAU KHI GỘP CÁC DÒNG TRÙNG TÊN (SẮP XẾP THEO TỔNG TIỀN CHI TIÊU TỪ CAO XUỐNG THẤP):\n"
    for rank, g in enumerate(grouped_list, 1):
        grouped_str += (
            f"   - Hạng {rank}: {g['item_name']} | Xuất hiện: {g['line_count']} dòng | "
            f"Tổng số lượng: {g['total_quantity']} phần | Đơn giá: {_fmt_vnd(g['unit_price'])}/phần | "
            f"TỔNG TIỀN (sau khi gộp): {_fmt_vnd(g['total_spend'])}\n"
        )
        
    by_unit_price = sorted(grouped_map.values(), key=lambda g: g["unit_price"], reverse=True)
    highest_unit = by_unit_price[0]
    lowest_unit = by_unit_price[-1]
    top_spend_grouped = grouped_list[0]
    second_spend_grouped = grouped_list[1] if len(grouped_list) > 1 else None
    
    summary_str = (
        "\n3. CHỈ SỐ THỐNG KÊ TỔNG HỢP CHÍNH XÁC 100% (BẮT BUỘC DÙNG SỐ LIỆU NÀY KHI TRẢ LỜI):\n"
        f"   - Tổng số dòng hàng (line items) trên hóa đơn: {line_items_count} dòng hàng.\n"
        f"   - Số loại sản phẩm khác nhau (unique products): {unique_products_count} loại sản phẩm.\n"
        f"   - Tổng số lượng đơn vị hàng hóa (tổng số món): {total_units_count} món (đơn vị hàng hóa).\n"
        f"   - Tổng thành tiền của tất cả {line_items_count} dòng hàng: {_fmt_vnd(total_items_amount)}.\n"
        f"   - Loại sản phẩm khách hàng chi nhiều tiền nhất (khi gộp các dòng trùng tên lại): {top_spend_grouped['item_name']} "
        f"với tổng số tiền là {_fmt_vnd(top_spend_grouped['total_spend'])} ({top_spend_grouped['total_quantity']} phần x {_fmt_vnd(top_spend_grouped['unit_price'])}, xuất hiện ở {top_spend_grouped['line_count']} dòng)"
        + (f", cao hơn {second_spend_grouped['item_name']} ({_fmt_vnd(second_spend_grouped['total_spend'])}).\n" if second_spend_grouped else ".\n")
        + f"   - Sản phẩm có đơn giá (1 đơn vị) cao nhất trên hóa đơn: {highest_unit['item_name']} với đơn giá {_fmt_vnd(highest_unit['unit_price'])}.\n"
        + f"   - Sản phẩm có đơn giá (1 đơn vị) thấp nhất trên hóa đơn: {lowest_unit['item_name']} với đơn giá {_fmt_vnd(lowest_unit['unit_price'])}.\n"
    )
    
    return lines_str + grouped_str + summary_str

def is_out_of_scope_question(q: str) -> bool:
    """Phát hiện sớm các câu hỏi ngoài phạm vi hóa đơn/chi tiêu (viết code, giải toán, làm thơ...)"""
    q_norm = _remove_diacritics(q).strip()
    
    # Từ khóa ngoài phạm vi rõ ràng
    out_of_scope_keywords = [
        "code", "python", "javascript", "viet code", "lap trinh", "viet ham", "viet class",
        "html", "css", "c++", "java", "thuat toan", "bai tho", "lam tho", "ke chuyen",
        "thoi tiet", "dich tieng", "tap lam van", "giai toan", "tro chuyen"
    ]
    
    # Từ khóa cụ thể liên quan đến hóa đơn / chi tiêu
    invoice_keywords = [
        "hoa don", "chi tieu", "mua sam", "cua hang", "quan an", "tong tien", 
        "san pham", "mon hang", "gia tien", "vat", "thue", "voucher", "giam gia"
    ]
    
    has_out = any(re.search(r'\b' + re.escape(w) + r'\b', q_norm) for w in out_of_scope_keywords)
    has_inv = any(re.search(r'\b' + re.escape(w) + r'\b', q_norm) for w in invoice_keywords)
    
    return has_out and not has_inv

TIME_KEYWORDS = [
    "gan nhat", "moi nhat", "cu nhat", "dau tien", "cuoi cung", "gan day", "moi day", 
    "truoc do", "lan cuoi", "lan dau", "hom qua", "hom nay", "tuan truoc", "thang truoc", "nay gio"
]

COMPARE_KEYWORDS = [
    "lon nhat", "nho nhat", "dat nhat", "re nhat", "cao nhat", "thap nhat", "nhieu nhat", "it nhat",
    "tong tat ca", "tat ca hoa don", "bao nhieu hoa don", "may hoa don", "tong tien", "bao nhieu",
    "tong cong", "tat ca", "tong so", "may cai", "danh sach", "liet ke", "nhieu tien nhat", "it tien nhat"
]

def classify_question(question: str) -> str:
    """Phân loại câu hỏi: 'time', 'compare', hoặc 'normal'."""
    question_unaccented = _remove_diacritics(question)
    if any(kw in question_unaccented for kw in TIME_KEYWORDS):
        return "time"
    if any(kw in question_unaccented for kw in COMPARE_KEYWORDS):
        return "compare"
    return "normal"

# ==========================================
# --- API ĐỢT 7 & 8: HỎI ĐÁP RAG THÔNG MINH (ĐÃ BẢO MẬT BẰNG JWT) ---
# ==========================================

@router.post("/api/qa", response_model=QA_Response, tags=["Q&A RAG"])
@router.post("/api/qa/ask", response_model=QA_Response, tags=["Q&A RAG"])
async def ask_question(request: QA_Request, current_user: dict = Depends(get_current_user)):
    try:
        user_id = str(current_user["id"])
        username = current_user.get("username", "")
        
        # Kiểm tra bảo mật truy vấn tài khoản khác
        unauth_msg = check_unauthorized_user_query(request.question, username)
        if unauth_msg:
            if user_id not in chat_history_db:
                chat_history_db[user_id] = {}
            if request.invoice_id not in chat_history_db[user_id]:
                chat_history_db[user_id][request.invoice_id] = []
            chat_history_db[user_id][request.invoice_id].append({"role": "user", "content": request.question})
            chat_history_db[user_id][request.invoice_id].append({"role": "bot", "content": unauth_msg})
            save_chat_history()
            return QA_Response(status=200, message="Thành công", data=QA_Data(answer=unauth_msg))
        
        if is_out_of_scope_question(request.question):
            return QA_Response(status=200, message="Thành công", data=QA_Data(answer=OUT_OF_SCOPE_RESPONSE))
        
        # Nếu không chọn hóa đơn cụ thể (hoặc chọn 'all' / 'GLOBAL'), tự động chuyển sang hỏi đáp trên toàn bộ hóa đơn
        if not request.invoice_id or str(request.invoice_id).strip() in ("", "all", "ALL", "GLOBAL", "none", "None"):
            return await ask_question_global(Global_QA_Request(question=request.question), current_user=current_user)
        
        invoice = get_invoice_by_id(request.invoice_id, user_id=int(user_id))
        if not invoice:
            return QA_Response(status=404, message=f"Không tìm thấy hóa đơn với ID: {request.invoice_id}", data=None)
        
        all_items = invoice.get("hasItems") or []
        if not all_items:
            all_items = search_relevant_items(request.question, request.invoice_id, user_id=int(user_id))
            
        analytics_str = build_invoice_analytics_context(all_items)
        tax_val = float(invoice.get("tax_amount") or 0.0)

        context = f"""
Thông tin tổng quan hóa đơn (Chunk Cha):
- Tên cửa hàng: {invoice.get('store_name')}
- Địa chỉ: {invoice.get('store_address')}
- Ngày mua: {invoice.get('date')}
- Tổng tiền hóa đơn: {float(invoice.get('total_amount') or 0):,.0f}đ
- Tiền thuế GTGT (VAT): {tax_val:,.0f}đ

Chi tiết toàn bộ dòng hàng và thống kê toán học chính xác (Chunk Con & Analytics):
{analytics_str}

Nội dung OCR & chi tiết in trên mặt hóa đơn (bao gồm Mã số thuế, Số ĐT bàn, Hotline, Thu ngân, Quầy, Ticket, Tiền mặt, Tiền thối lại, VAT, và Dấu mộc):
{invoice.get('raw_text')}
"""
        
        prompt = f"""Bạn là một trợ lý kế toán AI thông minh. Dựa vào hình ảnh hóa đơn gốc đính kèm (nếu có) kết hợp với thông tin dữ liệu trích xuất dưới đây, hãy trả lời câu hỏi của người dùng một cách chính xác tuyệt đối bằng tiếng Việt.

{context}

QUY TẮC TRẢ LỜI BẮT BUỘC (TUÂN THỦ TUYỆT ĐỐI):
1. ĐỊNH DẠNG MARKDOWN SẮC NÉT, DỄ ĐỌC:
   - Viết câu trả lời tự nhiên, mạch lạc, rõ ràng.
   - Sử dụng cú pháp **in đậm** cho các số tiền, tổng cộng, số lượng, tên mặt hàng và thông tin quan trọng.
   - Sử dụng danh sách gạch đầu dòng `- ` khi liệt kê nhiều sản phẩm hoặc nhiều thông tin.
2. ĐỘ CHÍNH XÁC SỐ LIỆU & ĐỐI CHIẾU HÌNH ẢNH 100%:
   - Khi người dùng hỏi về tổng số lượng và tổng tiền của một mặt hàng xuất hiện ở nhiều dòng trên hóa đơn, BẮT BUỘC lấy đúng số liệu đã cộng gộp tại mục "2. BẢNG THỐNG KÊ SAU KHI GỘP CÁC DÒNG TRÙNG TÊN".
   - Khi người dùng hỏi số dòng hàng (line items), số loại sản phẩm khác nhau (unique products) và tổng số lượng đơn vị hàng hóa, BẮT BUỘC trả lời đúng theo mục "3. CHỈ SỐ THỐNG KÊ TỔNG HỢP CHÍNH XÁC 100%".
   - Khi người dùng hỏi nếu gộp các dòng trùng tên lại thì chi nhiều tiền nhất cho loại sản phẩm nào, BẮT BUỘC trả lời đúng sản phẩm hạng 1 tại mục "2. BẢNG THỐNG KÊ SAU KHI GỘP CÁC DÒNG TRÙNG TÊN" và mục "3. CHỈ SỐ THỐNG KÊ TỔNG HỢP CHÍNH XÁC 100%".
   - Khi người dùng hỏi về Mã số thuế, Số điện thoại bàn, Hotline, Số phiếu/Ticket, Thu ngân, Tiền thuế GTGT, hoặc các chi tiết thị giác trên mặt hóa đơn (như dấu mộc đỏ, chữ ký, ghi chú...), hãy đối chiếu trực tiếp cả phần "Nội dung OCR" lẫn HÌNH ẢNH HÓA ĐƠN ĐÍNH KÈM để trả lời chính xác từng chi tiết.

CÂU HỎI CỦA NGƯỜI DÙNG: {request.question}
"""
        # Nâng cấp Multimodal RAG: Đọc file ảnh hóa đơn gốc (nếu tồn tại) để truyền kèm cho Gemini
        image_bytes = None
        mime_type = "image/jpeg"
        img_rel_path = invoice.get("image_path")
        if img_rel_path:
            img_abs_path = img_rel_path if os.path.isabs(img_rel_path) else os.path.join(BASE_DIR, img_rel_path)
            if os.path.exists(img_abs_path):
                try:
                    with open(img_abs_path, "rb") as f_img:
                        image_bytes = f_img.read()
                    ext_lower = os.path.splitext(img_abs_path)[1].lower()
                    if ext_lower == ".png":
                        mime_type = "image/png"
                    elif ext_lower == ".webp":
                        mime_type = "image/webp"
                except Exception as e:
                    print(f"[WARN] Không thể đọc ảnh hóa đơn cho Multimodal Q&A: {e}")

        answer_text = call_llm_with_retry(prompt, image_bytes=image_bytes, mime_type=mime_type)
        final_answer = clean_answer_text(answer_text)
        
        if user_id not in chat_history_db:
            chat_history_db[user_id] = {}
        if request.invoice_id not in chat_history_db[user_id]:
            chat_history_db[user_id][request.invoice_id] = []
        
        chat_history_db[user_id][request.invoice_id].append({"role": "user", "content": request.question})
        chat_history_db[user_id][request.invoice_id].append({"role": "bot", "content": final_answer})
        save_chat_history()
        
        return QA_Response(status=200, message="Thành công", data=QA_Data(answer=final_answer))
        
    except Exception as e:
        return QA_Response(status=500, message=f"Lỗi hệ thống Q&A: {str(e)}", data=None)


@router.post("/api/qa/global", response_model=QA_Response, tags=["Q&A RAG"])
async def ask_question_global(request: Global_QA_Request, current_user: dict = Depends(get_current_user)):
    try:
        user_id = str(current_user["id"])
        username = current_user.get("username", "")
        
        # Kiểm tra bảo mật truy vấn tài khoản khác
        unauth_msg = check_unauthorized_user_query(request.question, username)
        if unauth_msg:
            global_id = "GLOBAL"
            if user_id not in chat_history_db:
                chat_history_db[user_id] = {}
            if global_id not in chat_history_db[user_id]:
                chat_history_db[user_id][global_id] = []
            chat_history_db[user_id][global_id].append({"role": "user", "content": request.question})
            chat_history_db[user_id][global_id].append({"role": "bot", "content": unauth_msg})
            save_chat_history()
            return QA_Response(status=200, message="Thành công", data=QA_Data(answer=unauth_msg))
        
        if is_out_of_scope_question(request.question):
            return QA_Response(status=200, message="Thành công", data=QA_Data(answer=OUT_OF_SCOPE_RESPONSE))

        # Nếu câu hỏi có đính kèm mã hóa đơn cụ thể (dạng ID: INV_XXXXXXXX), chuyển thẳng sang luồng ask_question (Multimodal RAG có kèm ảnh gốc)
        specific_invoice_match = re.search(r'ID:\s*(INV_[A-Za-z0-9]+)', request.question)
        if specific_invoice_match:
            specific_invoice_id = specific_invoice_match.group(1)
            print(f"[DEBUG RAG] Phát hiện mã hóa đơn cụ thể {specific_invoice_id} trong Global Q&A -> Chuyển sang luồng Multimodal ask_question")
            return await ask_question(
                QA_Request(invoice_id=specific_invoice_id, question=request.question),
                current_user=current_user
            )
        
        # === PHÂN LOẠI CÂU HỎI ===
        question_type = classify_question(request.question)
        is_oldest = False
        
        if question_type == "time":
            # Câu hỏi về thời gian → Lấy TẤT CẢ hóa đơn đã sắp xếp theo ngày
            question_lower = request.question.lower()
            is_oldest = any(kw in question_lower for kw in ["cũ nhất", "đầu tiên", "lần đầu"])
            relevant_invoices = get_all_invoices_sorted(descending=not is_oldest, user_id=int(user_id))
            print(f"[DEBUG RAG] Câu hỏi về thời gian → Lấy {len(relevant_invoices)} hóa đơn đã sắp xếp theo ngày ({'cũ→mới' if is_oldest else 'mới→cũ'})")
        elif question_type == "compare":
            # Câu hỏi so sánh → Lấy TẤT CẢ hóa đơn để so sánh
            relevant_invoices = get_all_invoices_sorted(descending=True, user_id=int(user_id))
            print(f"[DEBUG RAG] Câu hỏi so sánh → Lấy {len(relevant_invoices)} hóa đơn để so sánh")
        else:
            # Câu hỏi thông thường → dùng vector search như cũ
            rewrite_prompt = f"""Phân tích câu hỏi sau và trích xuất ra các từ khóa danh từ, động từ cốt lõi nhất để dùng cho công cụ tìm kiếm cơ sở dữ liệu.
Nếu câu hỏi mang tính liệt kê (tất cả quán ăn, tất cả hóa đơn), hãy thêm các từ khóa: "tên cửa hàng, quán ăn, nhà hàng, tổng tiền, mua sắm".
Câu hỏi: '{request.question}'
CHỈ TRẢ VỀ CÁC TỪ KHÓA, CÁCH NHAU BẰNG DẤU PHẨY. Tuyệt đối không giải thích."""
            
            search_keywords = call_llm_with_retry(rewrite_prompt).strip()
            print(f"[DEBUG RAG] Từ khóa tìm kiếm đã tối ưu: {search_keywords}")
            time.sleep(1)
            relevant_invoices = global_search_invoices(search_keywords, user_id=int(user_id))
        
        is_item_query = any(w in _remove_diacritics(request.question) for w in [
            "mon", "san pham", "hang hoa", "an gi", "uong gi", "do an", "thuc uong", 
            "dat nhat", "re nhat", "it nhat", "nhieu nhat", "gia", "tien", "mua gi"
        ])
        if is_item_query or question_type in ("compare", "time"):
            # Luôn lấy danh sách đầy đủ các món hàng từ các hóa đơn chưa bị xóa
            relevant_items = get_all_active_items_for_user(int(user_id))
            print(f"[DEBUG RAG] Câu hỏi liên quan món hàng/so sánh -> Lấy {len(relevant_items)} món hàng active của user")
        else:
            relevant_items = global_search_items(request.question, user_id=int(user_id))

        # === LẤY LỊCH SỬ CHAT GẦN NHẤT ĐỂ HỖ TRỢ CÂU HỎI THAM CHIẾU ===
        CONTEXT_KEYWORDS = ["vừa hỏi", "ở trên", "trước đó", "câu trước", "đã hỏi", "đã nói", "2 hóa đơn", "hai hóa đơn", "những hóa đơn"]
        has_context_ref = any(kw in request.question.lower() for kw in CONTEXT_KEYWORDS)
        
        history_str = ""
        global_id = "GLOBAL"
        recent_history = chat_history_db.get(user_id, {}).get(global_id, [])
        if recent_history:
            recent_msgs = recent_history[-10:]
            history_str = "LỊCH SỬ HỘI THOẠI GẦN ĐÂY:\n"
            for msg in recent_msgs:
                role_label = "Người dùng" if msg["role"] == "user" else "Trợ lý"
                history_str += f"  {role_label}: {msg['content']}\n"
        
        if not relevant_invoices or has_context_ref or question_type in ('compare', 'time'):
            relevant_invoices = get_all_invoices_sorted(descending=True, user_id=int(user_id))
            print(f"[DEBUG RAG] Bổ sung danh sách hóa đơn: {len(relevant_invoices)} hóa đơn")
        
        context_str = "DỮ LIỆU TỔNG QUAN CÁC HÓA ĐƠN (ĐÃ SẮP XẾP THEO THỜI GIAN IMPORT TỪ GẦN NHẤT ĐẾN CŨ NHẤT):\n" if question_type == "time" else "DỮ LIỆU TỔNG QUAN CÁC HÓA ĐƠN (SẮP XẾP TỪ IMPORT MỚI NHẤT ĐẾN CŨ NHẤT):\n"
        
        for idx, inv in enumerate(relevant_invoices):
            store_name = inv.get('store_name')
            store_name_display = store_name if store_name and store_name.strip() else "Không rõ tên cửa hàng"
            store_address = inv.get('store_address')
            store_address_display = store_address.strip() if store_address and store_address.strip() else "Không rõ địa chỉ"
            
            upload_ts = int(inv.get('_additional', {}).get('creationTimeUnix', 0)) / 1000
            upload_str = datetime.datetime.fromtimestamp(upload_ts).strftime('%Y-%m-%d %H:%M:%S') if upload_ts > 0 else "Không rõ"
            
            order_note = f" [Vị trí {idx+1} - {'mới nhất' if idx == 0 and not is_oldest else 'cũ nhất' if idx == 0 and is_oldest else ''}]" if question_type == "time" else ""
            raw_t = repr(inv.get('raw_text', ''))
            tax_amt = float(inv.get('tax_amount') or 0.0)
            context_str += (
                f"- Hóa đơn {inv.get('invoice_id')}: Quán {store_name_display}, Địa chỉ: '{store_address_display}', "
                f"ngày mua {inv.get('date')}, tải lên lúc {upload_str}, tổng tiền {inv.get('total_amount')}đ, "
                f"Tiền thuế GTGT (VAT): {tax_amt:,.0f}đ{order_note}. Nội dung OCR thô: {raw_t}\n"
            )
            
        context_str += "\nDỮ LIỆU CHI TIẾT CÁC MÓN HÀNG ĐÃ MUA (ĐÃ SẮP XẾP THEO GIÁ TIỀN TỪ CAO XUỐNG THẤP):\n"
        if relevant_items:
            for item in relevant_items:
                store = item.get('store_name', '')
                date = item.get('date', '')
                price = float(item.get('total_price', 0.0) or item.get('unit_price', 0.0) or 0.0)
                unit_p = float(item.get('unit_price', 0.0) or price)
                store_info = f", Quán: {store}" if store else ""
                date_info = f", Ngày: {date}" if date else ""
                context_str += f"- Món: '{item.get('item_name')}' | Đơn giá: {unit_p:,.0f}đ | Thành tiền: {price:,.0f}đ (Số lượng: {item.get('quantity', 1)}{store_info}{date_info})\n"
            context_str += "\nTHỐNG KÊ GỘP DÒNG TRÙNG TÊN & SỐ LƯỢNG:\n" + build_invoice_analytics_context(relevant_items) + "\n"
        else:
            context_str += "- Hiện tại không có dữ liệu món hàng cụ thể.\n"
        
        current_time_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        prompt = f"""Bạn là một trợ lý AI thông minh chuyên phân tích dữ liệu hóa đơn kế toán.
Thời gian hiện tại của hệ thống là: {current_time_str}.
LƯU Ý QUAN TRỌNG: 
- Nếu người dùng hỏi các câu như "nãy giờ", "vừa xong", "gần đây", hãy so sánh "thời gian tải lên" (import time) của các hóa đơn với thời gian hiện tại để lọc ra các hóa đơn mới được tải lên trong vòng vài tiếng đổ lại.
- Nếu người dùng hỏi "hôm nay", hãy lọc các hóa đơn có thời gian tải lên (hoặc ngày mua) khớp với ngày hôm nay ({current_time_str[:10]}).
Dưới đây là thông tin được trích xuất từ cơ sở dữ liệu:

--- DỮ LIỆU HÓA ĐƠN ---
{context_str}
-----------------------

{history_str}

HƯỚNG DẪN TRẢ LỜI (TUÂN THỦ TUYỆT ĐỐI):
0. NGUYÊN TẮC BẢO MẬT & QUYỀN RIÊNG TƯ TÀI KHOẢN (BẮT BUỘC):
   - Người dùng đang đăng nhập hiện tại có tên tài khoản là: '{username}'. Dữ liệu hóa đơn bên trên CHỈ THUỘC VỀ tài khoản '{username}'.
   - Nếu người dùng hỏi về tài khoản khác, người dùng khác (ví dụ: 'tài khoản tien123...', 'user khác...', 'hóa đơn của người khác'):
     BẮT BUỘC TỪ CHỐI và trả lời: "Vì lý do bảo mật và bảo vệ quyền riêng tư dữ liệu, bạn chỉ có thể tra cứu thông tin hóa đơn của chính tài khoản của bạn ({username}). Hệ thống không hỗ trợ xem hoặc tra cứu thông tin của tài khoản khác."
   - TUYỆT ĐỐI KHÔNG dùng dữ liệu của tài khoản hiện tại để trả lời thay thế như thể đó là dữ liệu của tài khoản khác.
1. Trả lời trực tiếp vào trọng tâm câu hỏi bằng ngôn ngữ tự nhiên, ngắn gọn. TUYỆT ĐỐI KHÔNG trình bày các bước suy luận, không tạo tiêu đề "Kết quả:" hay "Giải thích:".
2. LUẬT SỐ LƯỢNG: Nếu câu hỏi của người dùng ở dạng số ít (ví dụ: "hóa đơn gần nhất", "món đắt nhất", "món rẻ nhất", "hóa đơn lớn nhất"), BẮT BUỘC CHỈ TRẢ VỀ ĐÚNG 1 KẾT QUẢ DUY NHẤT. Nếu có nhiều món có giá cao nhất bằng nhau, hãy liệt kê các món đó.
3. QUY TẮC SO SÁNH GIÁ TIỀN & TOÁN HỌC CHÍNH XÁC:
   - Khi tìm "món đắt nhất / rẻ nhất / nhiều tiền nhất / ít tiền nhất", BẮT BUỘC đối chiếu chính xác giá trị số trong phần "DỮ LIỆU CHI TIẾT CÁC MÓN HÀNG ĐÃ MUA".
   - Số tiền lớn hơn thì đắt hơn: Ví dụ 60.000đ lớn hơn 55.000đ, nên món 60.000đ ĐẮT HƠN món 55.000đ. TUYỆT ĐỐI KHÔNG BAO GIỜ kết luận món có giá tiền thấp hơn lại là món đắt nhất.
   - Nêu rõ tên món, tên cửa hàng và giá tiền chính xác.
3b. QUY TẮC ĐỊA CHỈ & VỊ TRÍ CỬA HÀNG (TUÂN THỦ TUYỆT ĐỐI):
   - Khi người dùng hỏi về địa chỉ hoặc vị trí (ví dụ: "địa chỉ là gì", "quán ở đâu", "quán ở quận nào", "địa chỉ ở đâu"):
     + BẮT BUỘC sử dụng chính xác thông tin được ghi tại trường "Địa chỉ" của hóa đơn.
     + TUYỆT ĐỐI KHÔNG tự ý suy đoán, phóng tác hoặc bịa đặt thêm quận/huyện hay tên đường khác không có trong dữ liệu.
     + Nếu địa chỉ ghi "Không rõ địa chỉ", hãy trả lời trung thực là hóa đơn không thể hiện địa chỉ cụ thể.
4. KỸ THUẬT CHAIN-OF-THOUGHT CHO THỜI GIAN:
   - Khi so sánh ngày tháng, tự sắp xếp các ngày tháng theo thời gian thực tế để chọn đúng hóa đơn "gần nhất/mới nhất" (ngày lớn nhất) hoặc "cũ nhất" (ngày nhỏ nhất).
5. BẢO MẬT MÃ NỘI BỘ: TUYỆT ĐỐI KHÔNG xuất các mã kỹ thuật (như INV_f9665622...). Hãy gọi tên theo định dạng tự nhiên: [Tên cửa hàng/món hàng] vào ngày [Ngày tháng] với giá/tổng tiền [Số tiền].
6. Nếu hóa đơn bị khuyết tên cửa hàng (ghi là "Không rõ tên cửa hàng"), hãy trả lời: "Hóa đơn ngày [Ngày tháng] với tổng tiền [Số tiền] (chưa rõ tên cửa hàng)".
7. Nếu câu hỏi yêu cầu phân loại: "ăn gì" chỉ lọc đồ ăn, "uống gì" chỉ lọc thức uống.
8. LUẬT NGỮ CẢNH: Nếu người dùng tham chiếu đến câu hỏi trước đó (ví dụ: "2 hóa đơn tôi vừa hỏi", "hóa đơn ở trên"), hãy dựa vào phần LỊCH SỬ HỘI THOẠI GẦN ĐÂY để xác định chính xác các hóa đơn đã được đề cập, sau đó dùng DỮ LIỆU HÓA ĐƠN để tính toán.
9. ĐỊNH DẠNG MARKDOWN RÕ RÀNG: Viết câu trả lời tự nhiên, mạch lạc; sử dụng **in đậm** để làm nổi bật các số tiền, tổng cộng, tên mặt hàng, tên cửa hàng và ngày tháng quan trọng.

Câu hỏi của người dùng: "{request.question}"

Câu trả lời:"""
        
        answer_text = call_llm_with_retry(prompt)
        final_answer = clean_answer_text(answer_text)
        
        global_id = "GLOBAL"
        if user_id not in chat_history_db:
            chat_history_db[user_id] = {}
        if global_id not in chat_history_db[user_id]:
            chat_history_db[user_id][global_id] = []
            
        chat_history_db[user_id][global_id].append({"role": "user", "content": request.question})
        chat_history_db[user_id][global_id].append({"role": "bot", "content": final_answer})
        save_chat_history()
        
        return QA_Response(status=200, message="Thành công", data=QA_Data(answer=final_answer))
        
    except Exception as e:
        return QA_Response(status=500, message=f"Lỗi hệ thống Global Q&A: {str(e)}", data=None)

# ==========================================
# --- API ĐỢT 6: LỊCH SỬ CHAT THEO USER ID ---
# ==========================================

@router.get("/api/history/sessions", tags=["Q&A RAG"])
async def get_chat_sessions(current_user: dict = Depends(get_current_user)):
    """Trả về danh sách các phiên chat của user (bao gồm GLOBAL và các hóa đơn)"""
    user_id = str(current_user["id"])
    user_history = chat_history_db.get(user_id, {})
    sessions = []
    
    from database import get_invoice_by_id
    
    for session_id, messages in user_history.items():
        if not messages:
            continue
            
        last_msg = messages[-1]["content"]
        if session_id == "GLOBAL":
            session_name = "Hỏi đáp Tổng quát"
        else:
            inv = get_invoice_by_id(session_id, user_id=int(user_id))
            if inv and inv.get("store_name"):
                session_name = f"Hóa đơn {inv.get('store_name')}"
            else:
                session_name = f"Hóa đơn {session_id}"
                
        sessions.append({
            "session_id": session_id,
            "session_name": session_name,
            "last_message": last_msg,
            "msg_count": len(messages)
        })
        
    return {"status": 200, "message": "Thành công", "data": sessions}

@router.get("/api/history/{invoice_id}", tags=["Q&A RAG"])
@router.get("/api/qa/history/{invoice_id}", tags=["Q&A RAG"])
async def get_chat_history(invoice_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["id"])
    target_id = "GLOBAL" if (not invoice_id or invoice_id.strip() in ("", "all", "ALL", "GLOBAL", "none", "None")) else invoice_id
    history = chat_history_db.get(user_id, {}).get(target_id, [])
    return {"status": 200, "message": "Thành công", "data": history}

@router.get("/api/history", tags=["Q&A RAG"])
@router.get("/api/qa/history", tags=["Q&A RAG"])
async def get_chat_history_default(current_user: dict = Depends(get_current_user)):
    return await get_chat_history("GLOBAL", current_user)

@router.delete("/api/history/{session_id}", tags=["Q&A RAG"], summary="Xóa một phiên trò chuyện")
@router.delete("/api/qa/history/{session_id}", tags=["Q&A RAG"])
async def delete_chat_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Xóa một cuộc trò chuyện cụ thể (hoặc 'GLOBAL') của user"""
    user_id = str(current_user["id"])
    target_id = "GLOBAL" if (not session_id or session_id.strip() in ("", "all", "ALL", "GLOBAL", "none", "None")) else session_id
    if user_id in chat_history_db and target_id in chat_history_db[user_id]:
        del chat_history_db[user_id][target_id]
        save_chat_history()
        return {"status": 200, "message": f"Đã xóa lịch sử cuộc trò chuyện '{target_id}'."}
    return {"status": 200, "message": "Không tìm thấy cuộc trò chuyện để xóa."}

@router.delete("/api/history", tags=["Q&A RAG"], summary="Xóa toàn bộ các phiên trò chuyện của user")
@router.delete("/api/qa/history", tags=["Q&A RAG"])
async def delete_all_chat_sessions(current_user: dict = Depends(get_current_user)):
    """Xóa toàn bộ các cuộc trò chuyện của user"""
    user_id = str(current_user["id"])
    if user_id in chat_history_db:
        chat_history_db[user_id] = {}
        save_chat_history()
    return {"status": 200, "message": "Đã xóa toàn bộ lịch sử các cuộc trò chuyện."}
