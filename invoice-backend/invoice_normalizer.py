import re


# ==========================================
# TIỆN ÍCH HẬU XỬ LÝ
# ==========================================

# Cắt bỏ từ vị trí xuất hiện SĐT / Website / Email / MST trở về sau trong địa chỉ cửa hàng
_ADDRESS_CUT_PATTERN = re.compile(
    r"[\s,;|\-–]*(?:"
    r"(?<![\w])(?:s[đd]t|đt|dt|tel|phone|fax|hotline|website|web|e-?mail|mst|m[aã]\s*s[oố]\s*thu[eế])\s*[:.\-]"
    r"|(?<![\w])(?:hotline|website|e-?mail)(?![\w])"
    r"|https?://|www\."
    r").*$",
    re.IGNORECASE | re.DOTALL,
)


def clean_store_address(address: str) -> str:
    """Chỉ giữ lại địa chỉ vật lý: bỏ số điện thoại, hotline, website, email, mã số thuế."""
    addr = str(address or "").strip()
    if not addr:
        return ""
    addr = _ADDRESS_CUT_PATTERN.sub("", addr)
    # Bỏ các chuỗi số điện thoại trần còn sót ở cuối (VD: "... Q.1 0283 123 456")
    addr = re.sub(r"[\s,;\-]*(?:\+?84|0)\d[\d\s.\-]{7,}\s*$", "", addr)
    return addr.strip(" ,;-–|.")


# Ký tự đánh số / multilevel list ở đầu dòng: I. II. 1. 1.1. 2.a) a) - • * +
_LIST_PREFIX_PATTERN = re.compile(
    r"^\s*(?:[IVXLCDM]+[\.\)](?=\s)|[0-9]{1,3}(?:\.[0-9]{1,2})*[\.\)](?![\d])|[a-zA-Z][\.\)](?=\s)|[\-–—•●▪◦\*\+](?=\s|\w))\s*"
)


def strip_list_prefix(text: str) -> str:
    """Lặp loại bỏ toàn bộ ký tự đánh số phân cấp ở đầu chuỗi."""
    s = str(text or "").strip()
    for _ in range(6):
        new_s = _LIST_PREFIX_PATTERN.sub("", s, count=1).strip()
        if new_s == s:
            break
        s = new_s
    return s


def _infer_context_key(text: str, header: str, counter: int) -> str:
    """Suy luận tên trường cho dòng không có nhãn dựa trên tiêu đề mục phía trên hoặc nội dung câu."""
    t = text.lower()
    h = (header or "").strip().rstrip(":").strip()
    h_low = h.lower()
    if h:
        if "cam kết" in h_low or "cam ket" in h_low:
            return f"Cam kết {counter}"
        if "lý do" in h_low or "ly do" in h_low:
            return f"Lý do {counter}"
        if "ý kiến" in h_low or "y kien" in h_low or "xác nhận" in h_low:
            return "Ý kiến xác nhận"
        if "đề nghị" in h_low or "kiến nghị" in h_low:
            return f"Đề nghị {counter}"
        if "hồ sơ" in h_low or "kèm theo" in h_low:
            return f"Hồ sơ kèm theo {counter}"
        short_h = h if len(h) <= 40 else h[:40].rsplit(" ", 1)[0]
        return f"{short_h} ({counter})"
    if t.startswith("kính gửi") or t.startswith("kinh gui"):
        return "Kính gửi"
    if "xin cam kết" in t or "cam đoan" in t:
        return "Lời cam kết"
    if "lý do" in t or "vì " in t[:20]:
        return "Lý do / Nội dung trình bày"
    if "ký tên" in t or "ký, ghi rõ" in t or "ky ten" in t:
        return "Chữ ký"
    if "xác nhận" in t or "ý kiến" in t:
        return "Ý kiến xác nhận"
    if re.match(r"^(ngày|.*, ngày)\s*\d", t):
        return "Ngày tháng lập"
    if t.startswith(("cộng hòa", "cong hoa", "độc lập", "doc lap")):
        return "Quốc hiệu / Tiêu ngữ"
    return f"Nội dung {counter}"


def clean_document_form_items(items: list) -> list:
    """Làm sạch ký tự đầu dòng và đảm bảo mọi trường tài liệu đều có dạng 'Tên trường: Nội dung'."""
    cleaned = []
    current_header = ""
    header_counter = 0
    free_counter = 0
    for it in items or []:
        name = strip_list_prefix(it.get("item_name", ""))
        if not name:
            continue

        colon_idx = name.find(":")
        key = name[:colon_idx].strip() if colon_idx > 0 else ""
        val = name[colon_idx + 1:].strip() if colon_idx > 0 else ""

        # Dòng tiêu đề mục (VD: "Tôi xin cam kết:") -> ghi nhớ làm ngữ cảnh cho các dòng phía dưới
        if colon_idx > 0 and not val and len(key) <= 80:
            current_header = key
            header_counter = 0
            cleaned.append({**it, "item_name": f"Tiêu đề mục: {key}"})
            continue

        # Có nhãn hợp lệ (nhãn ngắn, không phải một câu dài chứa dấu ':')
        if colon_idx > 0 and 0 < len(key) <= 60:
            cleaned.append({**it, "item_name": f"{strip_list_prefix(key)}: {val}"})
            continue

        # Không có nhãn -> suy luận theo ngữ cảnh
        if current_header:
            header_counter += 1
            ctx_key = _infer_context_key(name, current_header, header_counter)
        else:
            free_counter += 1
            ctx_key = _infer_context_key(name, "", free_counter)
        if ctx_key == "Kính gửi" and name.lower().startswith(("kính gửi", "kinh gui")):
            name = re.sub(r"^k[íi]nh\s*g[ửu]i\s*", "", name, flags=re.IGNORECASE).strip(" :")
        cleaned.append({**it, "item_name": f"{ctx_key}: {name}"})

    for c in cleaned:
        c["unit"] = ""
        c["quantity"] = 1
        c["unit_price"] = 0.0
        c["total_price"] = 0.0
    return cleaned


def _parse_vnd(num_str: str) -> float:
    """Chuyển chuỗi tiền VNĐ ('21.521', '21,521', '21.521,00') thành số."""
    s = str(num_str or "").strip()
    s = re.sub(r"[.,]\d{2}$", "", s) if re.search(r"\d[.,]\d{3}[.,]\d{2}$", s) else s
    s = s.replace(".", "").replace(",", "").replace(" ", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def infer_tax_amount(text: str, total_amount: float, items_sum: float, store_name: str = "") -> float:
    """
    Suy luận tiền thuế GTGT khi AI trả về 0:
    1. Bảng tổng hợp thuế: '10%  215.179  21.521' (T.Suất | Giá chưa thuế | Tiền thuế).
    2. Dòng có nhãn: 'Thuế GTGT: 21.521', 'Tiền thuế (10%): 21.521', 'VAT: 21.521'.
    3. Chênh lệch total_amount - items_sum xấp xỉ 5% / 8% / 10% của items_sum.
    4. Chỉ ghi % thuế suất (VAT 8%) + 'đã bao gồm thuế' -> tính ngược từ tổng tiền.
    """
    if total_amount <= 0:
        return 0.0
    low = str(text or "").lower()
    max_plausible = total_amount * 0.12

    # 1. Bảng tổng hợp thuế
    table_tax = 0.0
    for rate_s, base_s, tax_s in re.findall(r"(\d{1,2})\s*%\s+([\d][\d.,]{2,})\s+([\d][\d.,]{1,})", low):
        rate, base, tax = int(rate_s), _parse_vnd(base_s), _parse_vnd(tax_s)
        if rate in (5, 8, 10) and base > 0 and tax > 0 and abs(base * rate / 100.0 - tax) <= max(2.0, tax * 0.02):
            table_tax += tax
    if 0 < table_tax <= max_plausible:
        return float(round(table_tax))

    # 2. Dòng thuế có nhãn
    label_matches = re.findall(
        r"(?:thu[eế]\s*gtgt|ti[eề]n\s*thu[eế]|vat\s*amount|thu[eế]\s*vat|\bvat\b|\btax\b)"
        r"\s*(?:\(?\s*\d{1,2}\s*%\s*\)?)?\s*[:=]?\s*([\d][\d.,]{2,})",
        low,
    )
    label_values = [_parse_vnd(v) for v in label_matches]
    label_values = [v for v in label_values if 0 < v <= max_plausible]
    if label_values:
        return float(round(max(label_values)))

    # 3. Chênh lệch giữa tổng thanh toán và tổng tiền hàng chưa thuế
    if items_sum > 0 and total_amount > items_sum:
        diff = total_amount - items_sum
        ratio = diff / items_sum * 100.0
        if any(abs(ratio - r) <= 0.6 for r in (5, 8, 10)):
            return float(round(diff))

    # 4. Chỉ có thuế suất %
    has_vat_mention = any(kw in low for kw in ["vat", "gtgt", "thuế", "thue"])
    rates = [int(m) for m in re.findall(r"(?:vat|gtgt|thu[eế]\s*su[aấ]t)\s*[:\-]?\s*(5|8|10)\s*%", low)]
    if not rates and has_vat_mention:
        rates = [int(m) for m in re.findall(r"\b(5|8|10)\s*%", low)]
    is_inclusive = any(
        kw in low for kw in ["đã bao gồm thuế", "da bao gom thue", "đã gồm thuế", "da gom thue",
                             "bao gồm gtgt", "bao gom gtgt", "bao gồm vat", "bao gom vat"]
    ) or (items_sum > 0 and abs(items_sum - total_amount) <= 10.0)
    if not rates and (is_inclusive and has_vat_mention or "aeon" in store_name.lower()):
        rates, is_inclusive = [8], True
    if rates:
        rate = max(set(rates), key=rates.count)
        if is_inclusive:
            return float(round(total_amount * rate / (100.0 + rate)))
        return float(round(total_amount * rate / 100.0))
    return 0.0

def build_invoice_prompt(ocr_text: str) -> str:
    """Xây dựng prompt trích xuất Multimodal hỗ trợ song song cả Hóa đơn (SROIE) và Tài liệu / Biểu mẫu có cấu trúc (FUNSD)."""
    return f"""Bạn là một chuyên gia Document AI đa phương thức (Multimodal Document AI), chuyên trích xuất dữ liệu từ cả 2 loại chứng từ:
1. HÓA ĐƠN MUA BÁN / BIÊN LAI THANH TOÁN (Dataset SROIE & Hóa đơn thực tế).
2. TÀI LIỆU / BIỂU MẪU CÓ CẤU TRÚC (Dataset FUNSD: Phiếu đăng ký, phiếu thông tin, đơn đề nghị, biểu mẫu hành chính/khoa học/y tế có các cặp Nhãn trường Key -> Nội dung Value và các ô chọn Checkbox).

Hãy đối chiếu trực tiếp HÌNH ẢNH CHỨNG TỪ ĐÍNH KÈM với văn bản OCR dưới đây để khôi phục thông tin chuẩn xác 100%:

VĂN BẢN OCR THAM KHẢO:
---
{ocr_text}
---

QUY TẮC TRÍCH XUẤT BẮT BUỘC:
A. PHÂN BIỆT LOẠI CHỨNG TỪ (`invoice_type`):
   Phân loại vào ĐÚNG 1 trong 6 giá trị sau:
   - "Document/Form": Nếu ảnh là Phiếu đăng ký, Phiếu thông tin, Đơn từ, Biểu mẫu hành chính/khoa học/thí nghiệm/nội bộ (dạng FUNSD, có các trường Key-Value, ô Checkbox [X], chữ ký... chứ không phải hóa đơn mua bán hàng hóa).
   - "Supermarket": Hóa đơn siêu thị, cửa hàng tiện lợi, tạp hóa (Big C, WinMart, Co.opmart, AEON, Circle K, GS25, Bách Hóa Xanh...).
   - "Cafe/Restaurant": Hóa đơn quán cà phê, trà sữa, nhà hàng, quán ăn (Phúc Long, Highlands Coffee, Starbucks, Kichi-Kichi, Gogi House, KFC...).
   - "Utility": Hóa đơn điện, nước, internet, viễn thông, dịch vụ công ích.
   - "Shopping": Hóa đơn cửa hàng thời trang, mỹ phẩm, điện máy, mua sắm bán lẻ (Glam Beautique, Uniqlo, Shopee, Guardian...).
   - "Other": Các loại hóa đơn mua bán khác.

B. QUY TẮC KHI CHỨNG TỪ LÀ TÀI LIỆU / BIỂU MẪU ("invoice_type": "Document/Form" - chuẩn FUNSD):
   1. store_name: Lấy TIÊU ĐỀ CHÍNH của biểu mẫu/tài liệu (hoặc tên Tổ chức/Cơ quan ban hành biểu mẫu, ví dụ: "ACUTE TOXICITY IN MICE", "PHIẾU ĐĂNG KÝ THÔNG TIN", "PROJECT APPROVAL FORM"...).
   2. store_address: Lấy Địa chỉ, Đơn vị/Phòng ban/Nguồn (Source) hoặc Họ tên người đăng ký/người lập ghi trong biểu mẫu (ví dụ: "Lorillard - Organic Chemistry" hoặc địa chỉ người khai).
   3. date: Ngày đăng ký / ngày lập / ngày nhận / ngày hoàn thành ghi trong biểu mẫu (chuẩn hóa về DD/MM/YYYY nếu có thể, ví dụ "26/08/1980", hoặc giữ nguyên chuỗi ngày tháng trên biểu mẫu).
   4. total_amount và tax_amount: Để 0.0 (nếu biểu mẫu không có tổng tiền thanh toán).
   5. BẢO TOÀN 100% NỘI DUNG: BẮT BUỘC trích xuất TẤT CẢ mọi dòng thông tin, đoạn văn, mục chọn, bảng biểu, phần mở đầu ("Kính gửi..."), phần nội dung chính, phần cam kết và phần chữ ký/xác nhận ở cuối tài liệu vào danh sách items. TUYỆT ĐỐI KHÔNG tóm tắt, KHÔNG gộp, KHÔNG bỏ sót bất kỳ dòng nào.
   6. LOẠI BỎ KÝ TỰ ĐÁNH SỐ / MULTILEVEL LIST Ở ĐẦU item_name: TUYỆT ĐỐI KHÔNG để các tiền tố như "I.", "II.", "1.", "1.1.", "2.a)", "a)", "-", "•", "+", "*" ở đầu item_name.
      Ví dụ: "1.1. Họ và tên: Nguyễn Văn A" -> phải xuất là "Họ và tên: Nguyễn Văn A".
   7. TỰ SUY LUẬN TÊN TRƯỜNG THEO NGỮ CẢNH: Với các câu/đoạn văn KHÔNG có nhãn in sẵn (không có dấu hai chấm ":"), BẮT BUỘC dựa vào tiêu đề phía trên hoặc ý nghĩa câu để tự gán nhãn theo dạng "<Tên trường theo ngữ cảnh>: <Nội dung đầy đủ>". Ví dụ:
      - Dưới dòng "Tôi xin cam kết:" có 2 ý gạch đầu dòng -> "Cam kết 1: <nội dung 1>", "Cam kết 2: <nội dung 2>".
      - "Kính gửi: Ban Giám hiệu..." -> giữ "Kính gửi: Ban Giám hiệu...".
      - Đoạn văn trình bày lý do -> "Lý do / Nội dung trình bày: ...".
      - Phần ý kiến/xác nhận cuối trang -> "Ý kiến xác nhận: ...", phần ký tên -> "Người làm đơn (ký tên): ...".
   8. items: Mỗi phần tử có cấu trúc:
      {{"item_name": "<Tên nhãn trường (Key)>: <Nội dung tương ứng (Value)>", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
      - Ví dụ với biểu mẫu FUNSD:
        + {{"item_name": "COMPOUND: 3-Hydroxy-3-methylbutanoic acid (Tur 13)", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
        + {{"item_name": "SOURCE: Lorillard - Organic Chemistry", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
        + {{"item_name": "INVESTIGATOR(S): H. S. Tong & M. S. Forte", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
        + {{"item_name": "ROUTE OF ADMINISTRATION: P.O. (Checked [X])", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
      - CHÚ Ý ĐẶC BIỆT VỚI Ô CHECKBOX: Quan sát kỹ trên ảnh xem ô Checkbox nào được đánh dấu "X", dấu tick hoặc tô đậm, và ghi rõ trạng thái "(Checked [X])" vào nội dung Value của trường đó.
   9. raw_text_enriched: Chép lại NGUYÊN VĂN ĐẦY ĐỦ 100% toàn bộ tiêu đề, tất cả các trường Key-Value, đoạn văn, bảng biểu, các ô Checkbox được chọn/không chọn, chữ viết tay, chữ ký và con dấu trên tài liệu (không tóm tắt, không cắt bớt).

C. QUY TẮC KHI CHỨNG TỪ LÀ HÓA ĐƠN MUA HÀNG / BIÊN LAI (chuẩn SROIE):
   1. store_name: Tên thương hiệu hoặc tên cửa hàng/siêu thị/nhà hàng chính thức in ở phần đầu hóa đơn.
      - TUYỆT ĐỐI KHÔNG lấy các dòng thông tin phụ như "PASSWORD WIFI", "WIFI", "Thu ngân", "Phiếu tính tiền", "Hóa đơn bán hàng", "Mã xác thực" làm tên cửa hàng.
   2. store_address: CHỈ chứa DUY NHẤT địa chỉ vật lý của chi nhánh/cửa hàng (Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố). Đọc kỹ từ hình ảnh để khôi phục đúng. Nếu không có địa chỉ thì trả về "".
      - TUYỆT ĐỐI KHÔNG đưa Số điện thoại (ĐT, SĐT, Tel, Phone, Hotline), Website (www., .com, .vn, http), Email hay Mã số thuế (MST) vào store_address.
   3. date: Ngày xuất hóa đơn theo định dạng chuẩn DD/MM/YYYY (ví dụ: "28/02/2019", "10/09/2026"). Nếu năm chỉ có 2 chữ số (YY) thì chuẩn hóa thành 4 chữ số (20YY hoặc 19YY phù hợp).
   4. total_amount: Tổng số tiền thanh toán cuối cùng trên hóa đơn (kiểu số thực float). Đối chiếu kỹ với tổng thành tiền của các dòng hàng và dòng "TỔNG CỘNG" / "THÀNH TIỀN" / "TỔNG THANH TOÁN" trên ảnh.
   5. tax_amount: Tổng tiền thuế GTGT / VAT trên hóa đơn (kiểu số thực float, làm tròn về số nguyên VNĐ):
      - Trường hợp 1: Trên hóa đơn có in sẵn số tiền thuế GTGT / VAT bằng tiền -> lấy đúng số tiền đó. Đọc kỹ BẢNG TỔNG HỢP THUẾ ở cuối hóa đơn (dòng "Thuế GTGT", "Tiền thuế", "VAT 8%", "VAT 10%", hoặc bảng dạng "T.Suat | GB chua co GTGT | Thue GTGT" như "2>10%  215.179  21.521" -> tax_amount = 21521.0). Nếu có nhiều dòng thuế suất thì CỘNG TỔNG tiền thuế các dòng.
      - Trường hợp 2: Trên hóa đơn KHÔNG in sẵn số tiền thuế bằng VNĐ mà chỉ ghi mức phần trăm thuế suất trên từng dòng hàng hoặc cuối phiếu (ví dụ: "VAT 8%", "VAT 10%", "GTGT 8%", "VAT 5%"...) kèm dòng "GIÁ TRÊN ĐÃ BAO GỒM THUẾ GTGT" (như hóa đơn siêu thị AEON, WinMart, Co.opmart...) -> BẮT BUỘC tự động tính ra số tiền thuế GTGT theo công thức giá đã gồm thuế:
        tax_amount = round(total_amount * vat_rate / (100 + vat_rate))
        (Ví dụ: total_amount = 48800 và các mặt hàng ghi VAT 8% -> tax_amount = round(48800 * 8 / 108) = 3615.0).
      - Trường hợp 3: Nếu hóa đơn hoàn toàn không đề cập đến VAT/GTGT thì mới để 0.0.
   6. items: Danh sách tất cả các dòng hàng hóa/dịch vụ xuất hiện trên hóa đơn theo cấu trúc:
      [{{"item_name": "Tên sản phẩm", "unit": "Đơn vị tính (Chai, Lon, Ly, Cái, Hộp, Kg, Gói, Phần... hoặc \"\" nếu không rõ)", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}]
      - Trên nhiều hóa đơn siêu thị/nhà hàng, cột ngoài cùng bên trái là cột "VAT" (mã nhóm thuế, ví dụ số 2) hoặc "STT". TUYỆT ĐỐI KHÔNG nhầm cột mã VAT hoặc STT ở đầu dòng thành số lượng (quantity) của sản phẩm!
      - Kiểm tra toán học cho từng dòng: quantity * unit_price phải bằng total_price.
      - Giữ nguyên từng dòng hàng theo đúng thứ tự in trên hóa đơn, KHÔNG tự ý gộp các dòng sản phẩm trùng tên.
   7. raw_text_enriched: Nhìn trực tiếp vào ảnh hóa đơn và chép lại đầy đủ toàn bộ nội dung văn bản từ trên xuống dưới (Tên đơn vị, Địa chỉ, MST, Số ĐT, Số HĐ/Ticket, Thu ngân, danh sách hàng hóa, Tổng cộng, Bảng thuế GTGT, chữ ký và dấu mộc nếu có).

D. ĐẾM SỐ CHỨNG TỪ TRONG ẢNH (detected_invoice_count): Quan sát kỹ toàn bộ bức ảnh và ĐẾM số tờ hóa đơn/biên lai/tài liệu ĐỘC LẬP (tách rời về mặt vật lý, có tiêu đề/tên cửa hàng/tổng tiền riêng) xuất hiện. Trả về "detected_invoice_count": <số nguyên>. Nếu chỉ có 1 chứng từ thì trả về 1.
   sub_invoices (tùy chọn): Nếu có từ 2 chứng từ độc lập trở lên, liệt kê sơ lược mỗi chứng từ ({{"store_name": "...", "total_amount": 0.0}}) vào mảng "sub_invoices". Nếu chỉ có 1 chứng từ thì trả về "sub_invoices": [].

Chỉ trả về JSON thuần hợp lệ (không giải thích, không bọc trong markdown):
{{
    "store_name": "Tên cửa hàng hoặc Tiêu đề tài liệu/biểu mẫu",
    "store_address": "Địa chỉ cửa hàng hoặc Đơn vị/Người đăng ký",
    "date": "DD/MM/YYYY",
    "invoice_type": "Other",
    "total_amount": 0.0,
    "tax_amount": 0.0,
    "items": [
        {{"item_name": "Tên món hoặc Nhãn trường (Key): Nội dung (Value)", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
    ],
    "raw_text_enriched": "Toàn bộ văn bản chi tiết đọc từ ảnh hóa đơn/tài liệu, các ô checkbox [X], chữ ký và dấu mộc (nếu có)",
    "detected_invoice_count": 1,
    "sub_invoices": []
}}"""


def normalize_invoice_extracted_data(parsed_json: dict, raw_text: str) -> dict:
    """
    Hậu xử lý và kiểm toán toán học tổng quát cho mọi loại hóa đơn:
    1. Chuẩn hóa tên thương hiệu phổ biến nếu store_name bị trống hoặc rơi vào từ khóa rác.
    2. Chuẩn hóa định dạng ngày DD/MM/YYYY.
    3. Kiểm toán toán học từng dòng hàng (quantity * unit_price == total_price), chống nhầm cột VAT thành số lượng.
    4. Kết hợp raw_text từ OCR và raw_text_enriched từ Multimodal AI để bảo toàn 100% thông tin trên mặt hóa đơn.
    """
    if not isinstance(parsed_json, dict):
        return {}

    raw_text_str = str(raw_text or "").strip()
    enriched_str = str(parsed_json.get("raw_text_enriched") or "").strip()
    combined_lower = (raw_text_str + "\n" + enriched_str).lower()

    # 1. Chuẩn hóa tên thương hiệu (Fuzzy Brand Matching) khi store_name trống hoặc là từ khóa nhiễu
    noise_store_names = {
        "", "n/a", "none", "unknown", "wifi", "password", "password wifi",
        "thu ngan", "thu ngân", "hoa don", "hóa đơn", "phieu tinh tien",
        "phiếu tính tiền", "ma xac thuc", "mã xác thực", "macqt", "lucky"
    }
    current_store = str(parsed_json.get("store_name") or "").strip()

    brand_rules = [
        (["phuc long", "phuclong", "pluiclon", "phiuciong", "piiclong", "phdctong", "phuc tog", "phuctog"], "Phúc Long"),
        (["highlands coffee", "highland", "hightland"], "Highlands Coffee"),
        (["big c thang long", "bigc thanglong"], "Big C Thăng Long"),
        (["big c", "bigc"], "Big C"),
        (["winmart+", "winmart", "vinmart"], "WinMart"),
        (["co.opmart", "coopmart", "co-opmart"], "Co.opmart"),
        (["starbucks", "starbuck"], "Starbucks"),
        (["kichi-kichi", "kichi kichi", "kichi"], "Kichi-Kichi"),
        (["gogi house", "gogi"], "Gogi House"),
        (["the coffee house", "thecoffeehouse", "coffee house"], "The Coffee House"),
        (["tocotoco", "toco toco"], "TocoToco"),
        (["circle k", "circlek"], "Circle K"),
        (["gs25"], "GS25"),
        (["familymart", "family mart"], "FamilyMart"),
        (["aeon"], "AEON"),
        (["lotte mart", "lottemart"], "Lotte Mart"),
    ]

    if current_store.lower() in noise_store_names:
        for keywords, canonical_name in brand_rules:
            if any(kw in combined_lower for kw in keywords):
                parsed_json["store_name"] = canonical_name
                break

    # 2. Chuẩn hóa địa chỉ nếu nhận giá trị rác "N/A"
    current_address = str(parsed_json.get("store_address") or "").strip()
    if current_address.upper() in ("N/A", "NONE", "NULL"):
        parsed_json["store_address"] = ""

    # 3. Chuẩn hóa định dạng ngày tháng (DD/MM/YYYY)
    current_date = str(parsed_json.get("date") or "").strip()
    if not current_date or current_date.upper() in ("N/A", "NONE", "NULL") or len(current_date) < 6:
        date_match = re.search(r"\b(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})\b", raw_text_str + "\n" + enriched_str)
        if date_match:
            d, m, y = date_match.groups()
            d_i, m_i = int(d), int(m)
            if d_i <= 12 and m_i > 12:
                d_i, m_i = m_i, d_i
            if len(y) == 2:
                y = ("19" + y) if int(y) >= 50 else ("20" + y)
            parsed_json["date"] = f"{d_i:02d}/{m_i:02d}/{y}"
    else:
        date_match = re.match(r"^(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})$", current_date)
        if date_match:
            d, m, y = date_match.groups()
            d_i, m_i = int(d), int(m)
            if d_i <= 12 and m_i > 12:
                d_i, m_i = m_i, d_i
            if len(y) == 2:
                y = ("19" + y) if int(y) >= 50 else ("20" + y)
            parsed_json["date"] = f"{d_i:02d}/{m_i:02d}/{y}"

    # 4. Kiểm toán toán học từng dòng hàng (items)
    raw_items = parsed_json.get("items") or []
    normalized_items = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("item_name") or "").strip()
        if not name:
            continue

        try:
            qty = int(float(item.get("quantity", 1) or 1))
        except (ValueError, TypeError):
            qty = 1
        if qty <= 0:
            qty = 1

        try:
            unit = float(item.get("unit_price", 0.0) or 0.0)
        except (ValueError, TypeError):
            unit = 0.0

        try:
            tot = float(item.get("total_price", 0.0) or 0.0)
        except (ValueError, TypeError):
            tot = 0.0

        # Nếu quantity > 1 nhưng unit_price == total_price (do đọc nhầm cột mã VAT ở đầu dòng thành số lượng)
        if qty > 1 and unit > 0 and tot > 0 and abs(unit - tot) < 1.0:
            qty = 1

        # Khôi phục hoặc đồng bộ unit_price và total_price theo công thức quantity * unit_price == total_price
        if tot > 0 and unit <= 0:
            unit = float(round(tot / qty))
        elif unit > 0 and tot <= 0:
            tot = float(round(unit * qty))
        elif tot > 0 and unit > 0 and abs(qty * unit - tot) > 1.0:
            unit = float(round(tot / qty))
        else:
            unit = float(round(unit))
            tot = float(round(tot))

        unit_label = str(item.get("unit") or "").strip()
        if unit_label.upper() in ("N/A", "NONE", "NULL", "-"):
            unit_label = ""

        normalized_items.append({
            "item_name": name,
            "unit": unit_label,
            "quantity": qty,
            "unit_price": unit,
            "total_price": tot,
        })

    parsed_json["items"] = normalized_items

    # 5. Kiểm toán total_amount và tax_amount (tự động làm tròn VNĐ về số nguyên để không bắt user chọn lại)
    try:
        total_amount = float(round(float(parsed_json.get("total_amount", 0.0) or 0.0)))
    except (ValueError, TypeError):
        total_amount = 0.0

    items_sum = float(round(sum(i["total_price"] for i in normalized_items)))
    if total_amount <= 0 and items_sum > 0:
        total_amount = items_sum
    parsed_json["total_amount"] = total_amount

    try:
        tax_amount = float(round(float(parsed_json.get("tax_amount", 0.0) or 0.0)))
    except (ValueError, TypeError):
        tax_amount = 0.0

    # (Việc suy luận tax_amount khi bằng 0 được thực hiện ở bước 5c, sau khi đã xác định loại chứng từ)
    parsed_json["tax_amount"] = max(0.0, tax_amount)
    parsed_json["subtotal"] = float(round(max(0.0, total_amount - parsed_json["tax_amount"])))

    # 5b. Chuẩn hóa danh mục invoice_type khớp với 6 giá trị của Frontend (bao gồm Document/Form cho FUNSD)
    valid_types = {"Document/Form", "Supermarket", "Cafe/Restaurant", "Utility", "Shopping", "Other"}
    raw_type = str(parsed_json.get("invoice_type") or "").strip()
    store_l = str(parsed_json.get("store_name") or "").lower()

    form_indicators = [
        "form", "phiếu đăng ký", "phieu dang ky", "đơn đề nghị", "don de nghi",
        "phiếu thông tin", "biểu mẫu", "bieu mau", "compound", "investigator",
        "signature", "application", "registration", "acute toxicity", "memorandum",
        "questionnaire", "route of administration", "checked [x]"
    ]
    all_items_zero_price = (
        total_amount <= 0
        and len(normalized_items) > 0
        and all(float(i.get("total_price", 0.0) or 0.0) <= 0 for i in normalized_items)
    )

    if (
        raw_type == "Document/Form"
        or any(k in store_l or k in combined_lower for k in form_indicators)
        or all_items_zero_price
    ):
        parsed_json["invoice_type"] = "Document/Form"
    elif raw_type not in valid_types:
        if any(k in store_l or k in combined_lower for k in ["big c", "bigc", "winmart", "vinmart", "co.op", "coopmart", "aeon", "lotte", "circle k", "gs25", "familymart", "bách hóa xanh", "siêu thị"]):
            parsed_json["invoice_type"] = "Supermarket"
        elif any(k in store_l or k in combined_lower for k in ["phúc long", "phuc long", "highlands", "starbucks", "coffee", "cà phê", "ca phe", "trà sữa", "tra sua", "kichi", "gogi", "kfc", "lotteria", "jollibee", "tocotoco", "nhà hàng", "quán"]):
            parsed_json["invoice_type"] = "Cafe/Restaurant"
        elif any(k in store_l or k in combined_lower for k in ["điện lực", "evn", "tiền nước", "cấp nước", "viettel", "vnpt", "fpt telecom", "internet"]):
            parsed_json["invoice_type"] = "Utility"
        elif any(k in store_l or k in combined_lower for k in ["glam", "beautique", "guardian", "watsons", "uniqlo", "zara", "fashion", "shop"]):
            parsed_json["invoice_type"] = "Shopping"
        else:
            parsed_json["invoice_type"] = "Other"

    # 5c. Hậu xử lý theo loại chứng từ
    if parsed_json["invoice_type"] == "Document/Form":
        # Tài liệu / Biểu mẫu: không có tiền, làm sạch ký tự đầu dòng & suy luận tên trường
        parsed_json["total_amount"] = 0.0
        parsed_json["tax_amount"] = 0.0
        parsed_json["subtotal"] = 0.0
        parsed_json["items"] = clean_document_form_items(normalized_items)
    else:
        # Hóa đơn: làm sạch địa chỉ (bỏ SĐT, Website, MST...) và suy luận thuế GTGT nếu đang bằng 0
        parsed_json["store_address"] = clean_store_address(parsed_json.get("store_address", ""))
        if parsed_json["tax_amount"] <= 0 and total_amount > 0:
            inferred_tax = infer_tax_amount(
                raw_text_str + "\n" + enriched_str,
                total_amount,
                items_sum,
                str(parsed_json.get("store_name") or ""),
            )
            if inferred_tax > 0:
                parsed_json["tax_amount"] = inferred_tax
                parsed_json["subtotal"] = float(round(max(0.0, total_amount - inferred_tax)))

    # Chuẩn hóa số lượng chứng từ phát hiện trong ảnh
    try:
        detected_count = int(float(parsed_json.get("detected_invoice_count", 1) or 1))
    except (ValueError, TypeError):
        detected_count = 1
    sub_invoices = parsed_json.get("sub_invoices") or []
    if isinstance(sub_invoices, list) and len(sub_invoices) > detected_count:
        detected_count = len(sub_invoices)
    parsed_json["detected_invoice_count"] = max(1, detected_count)

    # 6. Gộp raw_text_enriched và raw_text từ OCR để không mất bất kỳ thông tin chi tiết nào
    if enriched_str:
        if raw_text_str and raw_text_str not in enriched_str:
            parsed_json["raw_text_enriched"] = (
                f"{enriched_str}\n\n--- [VĂN BẢN OCR BỔ SUNG] ---\n{raw_text_str}"
            )
        else:
            parsed_json["raw_text_enriched"] = enriched_str
    else:
        parsed_json["raw_text_enriched"] = raw_text_str

    return parsed_json
