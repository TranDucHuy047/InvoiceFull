import re


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
   5. items: Trích xuất TẤT CẢ các cặp Trường thông tin (Key - Value) trên biểu mẫu thành danh sách items, trong đó mỗi phần tử có:
      {{"item_name": "<Tên nhãn trường (Key)>: <Nội dung tương ứng (Value)>", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
      - Ví dụ với biểu mẫu FUNSD:
        + {{"item_name": "COMPOUND: 3-Hydroxy-3-methylbutanoic acid (Tur 13)", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
        + {{"item_name": "SOURCE: Lorillard - Organic Chemistry", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
        + {{"item_name": "INVESTIGATOR(S): H. S. Tong & M. S. Forte", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
        + {{"item_name": "ROUTE OF ADMINISTRATION: P.O. (Checked [X])", "unit": "", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
      - CHÚ Ý ĐẶC BIỆT VỚI Ô CHECKBOX: Quan sát kỹ trên ảnh xem ô Checkbox nào được đánh dấu "X", dấu tick hoặc tô đậm, và ghi rõ trạng thái "(Checked [X])" vào nội dung Value của trường đó.
   6. raw_text_enriched: Chép lại đầy đủ toàn bộ tiêu đề, tất cả các trường Key-Value, các bảng biểu, các ô Checkbox được chọn/không chọn, chữ viết tay, chữ ký và con dấu trên tài liệu.

C. QUY TẮC KHI CHỨNG TỪ LÀ HÓA ĐƠN MUA HÀNG / BIÊN LAI (chuẩn SROIE):
   1. store_name: Tên thương hiệu hoặc tên cửa hàng/siêu thị/nhà hàng chính thức in ở phần đầu hóa đơn.
      - TUYỆT ĐỐI KHÔNG lấy các dòng thông tin phụ như "PASSWORD WIFI", "WIFI", "Thu ngân", "Phiếu tính tiền", "Hóa đơn bán hàng", "Mã xác thực" làm tên cửa hàng.
   2. store_address: Địa chỉ chi nhánh/cửa hàng in ở đầu hóa đơn. Đọc kỹ từ hình ảnh để khôi phục đúng số nhà, tên đường, quận/huyện, tỉnh/thành phố. Nếu không có địa chỉ thì trả về "".
   3. date: Ngày xuất hóa đơn theo định dạng chuẩn DD/MM/YYYY (ví dụ: "28/02/2019", "10/09/2026"). Nếu năm chỉ có 2 chữ số (YY) thì chuẩn hóa thành 4 chữ số (20YY hoặc 19YY phù hợp).
   4. total_amount: Tổng số tiền thanh toán cuối cùng trên hóa đơn (kiểu số thực float). Đối chiếu kỹ với tổng thành tiền của các dòng hàng và dòng "TỔNG CỘNG" / "THÀNH TIỀN" / "TỔNG THANH TOÁN" trên ảnh.
   5. tax_amount: Tổng tiền thuế GTGT / VAT trên hóa đơn (kiểu số thực float, làm tròn về số nguyên VNĐ):
      - Trường hợp 1: Trên hóa đơn có in sẵn số tiền thuế GTGT / VAT bằng tiền -> lấy đúng số tiền đó.
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

D. sub_invoices (tùy chọn): Nếu trong CÙNG MỘT BỨC ẢNH có nhiều hơn 1 tờ hóa đơn/tài liệu độc lập, hãy liệt kê vào mảng "sub_invoices". Nếu chỉ có 1 chứng từ thì trả về "sub_invoices": [].

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

    # Nếu AI trả về tax_amount == 0 nhưng trên mặt hóa đơn có ghi mức thuế suất (VD: "VAT 8%", "VAT 10%", "GTGT 8%")
    if tax_amount <= 0 and total_amount > 0:
        has_vat_mention = any(
            kw in combined_lower
            for kw in ["vat", "gtgt", "thuế", "thue"]
        )
        vat_rates = [
            int(m)
            for m in re.findall(r"(?:vat|gtgt|thuế\s*suất|thue\s*suat)?\s*[:\-]?\s*(5|8|10)\s*%", combined_lower)
            if has_vat_mention
        ]
        is_inclusive = (
            any(
                kw in combined_lower
                for kw in [
                    "đã bao gồm thuế",
                    "da bao gom thue",
                    "đã gồm thuế",
                    "da gom thue",
                    "bao gồm gtgt",
                    "bao gom gtgt",
                    "bao gồm vat",
                    "bao gom vat",
                ]
            )
            or (items_sum > 0 and abs(items_sum - total_amount) <= 10.0)
        )
        if not vat_rates and (
            "đã bao gồm thuế" in combined_lower
            or "da bao gom thue" in combined_lower
            or "aeon" in str(parsed_json.get("store_name") or "").lower()
        ):
            vat_rates = [8]
            is_inclusive = True

        if vat_rates:
            # Lấy mức thuế suất xuất hiện phổ biến nhất trên hóa đơn
            dominant_rate = max(set(vat_rates), key=vat_rates.count)
            if is_inclusive:
                tax_amount = float(round(total_amount * dominant_rate / (100.0 + dominant_rate)))
            else:
                tax_amount = float(round(total_amount * dominant_rate / 100.0))

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
