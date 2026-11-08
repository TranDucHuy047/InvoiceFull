import re


def build_invoice_prompt(ocr_text: str) -> str:
    """Xây dựng prompt trích xuất hóa đơn Multimodal tổng quát cho mọi loại hóa đơn."""
    return f"""Bạn là một chuyên gia AI kế toán chuyên trích xuất dữ liệu hóa đơn tiếng Việt từ hình ảnh chứng từ gốc kết hợp với văn bản OCR.
Hãy đối chiếu trực tiếp HÌNH ẢNH HÓA ĐƠN ĐÍNH KÈM với văn bản OCR dưới đây để khôi phục thông tin hóa đơn chuẩn xác 100%:

VĂN BẢN OCR THAM KHẢO:
---
{ocr_text}
---

QUY TẮC TRÍCH XUẤT BẮT BUỘC (ÁP DỤNG TỔNG QUÁT CHO MỌI HÓA ĐƠN):
1. store_name: Tên thương hiệu hoặc tên cửa hàng/siêu thị/nhà hàng chính thức in ở phần đầu hóa đơn.
   - TUYỆT ĐỐI KHÔNG lấy các dòng thông tin phụ như "PASSWORD WIFI", "WIFI", "Thu ngân", "Phiếu tính tiền", "Hóa đơn bán hàng", "Mã xác thực" làm tên cửa hàng.
   - Không tự suy diễn tên trung tâm thương mại nếu không phải là đơn vị phát hành hóa đơn.
2. store_address: Địa chỉ chi nhánh/cửa hàng in ở đầu hóa đơn. Đọc kỹ từ hình ảnh để khôi phục đúng số nhà, tên đường, quận/huyện, tỉnh/thành phố. Nếu không có địa chỉ trên hóa đơn thì trả về "".
3. date: Ngày xuất hóa đơn theo định dạng chuẩn DD/MM/YYYY (ví dụ: "28/02/2019", "10/09/2026").
   - Quan sát kỹ dòng ngày giờ in trên ảnh hóa đơn (kể cả khi bị dấu mộc đè lên hoặc nếp gấp làm mờ). Nếu năm chỉ có 2 chữ số (YY) thì chuẩn hóa thành 4 chữ số (20YY).
4. invoice_type: Phân loại danh mục hóa đơn vào ĐÚNG 1 trong 5 giá trị sau:
   - "Supermarket": Siêu thị, cửa hàng tiện lợi, tạp hóa (Big C, WinMart, Co.opmart, AEON, Circle K, GS25, Bách Hóa Xanh...).
   - "Cafe/Restaurant": Quán cà phê, trà sữa, nhà hàng, quán ăn (Phúc Long, Highlands Coffee, Starbucks, Kichi-Kichi, Gogi House, KFC...).
   - "Utility": Hóa đơn điện, nước, internet, viễn thông, dịch vụ công ích.
   - "Shopping": Cửa hàng thời trang, mỹ phẩm, điện máy, mua sắm bán lẻ (Glam Beautique, Uniqlo, Shopee, Guardian...).
   - "Other": Các loại hóa đơn khác.
5. total_amount: Tổng số tiền thanh toán cuối cùng trên hóa đơn (kiểu số thực float).
   - Đối chiếu kỹ với tổng thành tiền của các dòng hàng và dòng "TỔNG CỘNG" / "THÀNH TIỀN" / "TỔNG THANH TOÁN" trên ảnh để tránh nhầm lẫn do nếp gấp giấy (như nhầm số 6 thành số 8).
6. tax_amount: Tổng tiền thuế GTGT / VAT ghi trên hóa đơn (kiểu số thực float). Nếu hóa đơn có bảng kê thuế GTGT thì lấy đúng số tiền thuế GTGT; nếu không ghi tách biệt thì để 0.0.
7. items: Danh sách tất cả các dòng hàng hóa/dịch vụ xuất hiện trên hóa đơn theo cấu trúc:
   [{{"item_name": "Tên sản phẩm", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}]
   - QUY TẮC SỐ LƯỢNG (QUANTITY) VÀ CỘT MÃ THUẾ / STT:
     + Trên nhiều hóa đơn siêu thị/nhà hàng, cột ngoài cùng bên trái là cột "VAT" (mã nhóm thuế, ví dụ số 2) hoặc "STT". TUYỆT ĐỐI KHÔNG nhầm cột mã VAT hoặc STT ở đầu dòng thành số lượng (quantity) của sản phẩm!
     + Số lượng mặc định của mỗi dòng hàng là 1, trừ khi có cột số lượng rõ ràng hoặc ngay bên dưới tên sản phẩm có dòng nhân số lượng x đơn giá (ví dụ: "2 x 6.400d" -> quantity=2, unit_price=6400.0, total_price=12800.0).
     + Kiểm tra toán học cho từng dòng: quantity * unit_price phải bằng total_price.
   - QUY TẮC GIỮ NGUYÊN DÒNG HÀNG (LINE ITEMS):
     + Giữ nguyên từng dòng hàng theo đúng thứ tự in trên hóa đơn. TUYỆT ĐỐI KHÔNG tự ý gộp các dòng sản phẩm trùng tên lại thành 1 dòng.
8. raw_text_enriched: Nhìn trực tiếp vào ảnh hóa đơn và chép lại đầy đủ, chính xác toàn bộ nội dung văn bản xuất hiện trên mặt hóa đơn từ trên xuống dưới, bao gồm:
   - Tên đơn vị/công ty, Địa chỉ, Mã số thuế (MST), Số điện thoại bàn (Số ĐT), Số Hotline.
   - Số phiếu (Ticket/Số HĐ), Thu ngân, Quầy, Ngày giờ in.
   - Toàn bộ danh sách các dòng hàng, số lượng, đơn giá, thành tiền.
   - Tổng cộng, Tổng số lượng mặt hàng, Tiền mặt/Tiền khách đưa, Tiền thối lại.
   - Bảng chi tiết thuế suất GTGT (Thuế suất, Giá bán chưa có GTGT, Thuế GTGT).
   - Ghi chú rõ nếu trên mặt hóa đơn có đóng dấu mộc (màu sắc, hình dáng, nội dung chữ bên trong dấu mộc như "HÀNG ĐÃ XUẤT", "ĐÃ THU TIỀN"...) hoặc chữ ký.

Chỉ trả về JSON thuần hợp lệ (không giải thích, không bọc trong markdown):
{{
    "store_name": "Tên cửa hàng",
    "store_address": "Địa chỉ cửa hàng",
    "date": "DD/MM/YYYY",
    "invoice_type": "Other",
    "total_amount": 0.0,
    "tax_amount": 0.0,
    "items": [
        {{"item_name": "Tên món", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}}
    ],
    "raw_text_enriched": "Toàn bộ văn bản chi tiết đọc từ ảnh hóa đơn và ghi chú dấu mộc (nếu có)"
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
    if not current_date or current_date.upper() in ("N/A", "NONE", "NULL") or len(current_date) < 8:
        date_match = re.search(r"\b(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})\b", raw_text_str + "\n" + enriched_str)
        if date_match:
            d, m, y = date_match.groups()
            if len(y) == 2:
                y = "20" + y
            parsed_json["date"] = f"{int(d):02d}/{int(m):02d}/{y}"
    else:
        date_match = re.match(r"^(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})$", current_date)
        if date_match:
            d, m, y = date_match.groups()
            if len(y) == 2:
                y = "20" + y
            parsed_json["date"] = f"{int(d):02d}/{int(m):02d}/{y}"

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
            unit = round(tot / qty, 2)
        elif unit > 0 and tot <= 0:
            tot = round(unit * qty, 2)
        elif tot > 0 and unit > 0 and abs(qty * unit - tot) > 1.0:
            unit = round(tot / qty, 2)

        normalized_items.append({
            "item_name": name,
            "quantity": qty,
            "unit_price": unit,
            "total_price": tot,
        })

    parsed_json["items"] = normalized_items

    # 5. Kiểm toán total_amount và tax_amount
    try:
        total_amount = float(parsed_json.get("total_amount", 0.0) or 0.0)
    except (ValueError, TypeError):
        total_amount = 0.0

    items_sum = sum(i["total_price"] for i in normalized_items)
    if total_amount <= 0 and items_sum > 0:
        total_amount = round(items_sum, 2)
    parsed_json["total_amount"] = total_amount

    try:
        tax_amount = float(parsed_json.get("tax_amount", 0.0) or 0.0)
    except (ValueError, TypeError):
        tax_amount = 0.0
    parsed_json["tax_amount"] = max(0.0, tax_amount)
    parsed_json["subtotal"] = round(max(0.0, total_amount - parsed_json["tax_amount"]), 2)

    # 5b. Chuẩn hóa danh mục invoice_type khớp với 5 giá trị của Frontend
    valid_types = {"Supermarket", "Cafe/Restaurant", "Utility", "Shopping", "Other"}
    raw_type = str(parsed_json.get("invoice_type") or "").strip()
    if raw_type not in valid_types:
        store_l = str(parsed_json.get("store_name") or "").lower()
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
