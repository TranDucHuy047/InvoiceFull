from pydantic import BaseModel
import os
import re
import json
import uuid
import time
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from typing import List, Optional

# Import định dạng dữ liệu
from schemas import BatchInvoiceResponse, InvoiceData

# Import các hàm xử lý Database và OCR
from database import (
    empty_trash_invoices,
    batch_delete_invoices_completely,
    batch_restore_invoices,
    get_filtered_invoices, 
    delete_invoice_completely, 
    save_invoice, 
    soft_delete_invoice, 
    restore_invoice, 
    get_trash_invoices, 
    get_invoice_by_id
)
from ocr_engine import extract_text_from_image
from auth import get_current_user

# Import service gọi AI và chuẩn hóa hóa đơn
from llm_service import call_llm_with_retry
from invoice_normalizer import build_invoice_prompt, normalize_invoice_extracted_data

# Khởi tạo Router
router = APIRouter()

MULTI_INVOICE_ERROR = (
    "Chỉ được quét 1 hóa đơn trong mỗi bức ảnh! Hệ thống phát hiện có từ 2 hóa đơn trở lên, "
    "vui lòng sử dụng công cụ Cắt ảnh (Crop) để cắt riêng từng hóa đơn."
)


def detect_multiple_invoices(parsed_json: dict) -> bool:
    """Trả về True nếu AI phát hiện từ 2 hóa đơn/chứng từ độc lập trở lên trong cùng 1 bức ảnh."""
    try:
        count = int(float(parsed_json.get("detected_invoice_count", 1) or 1))
    except (ValueError, TypeError):
        count = 1
    subs = parsed_json.get("sub_invoices") or []
    return count >= 2 or (isinstance(subs, list) and len(subs) >= 2)


def parse_llm_json_response(response_text: str) -> dict:
    """
    Trích xuất và phân tích cú pháp JSON từ phản hồi AI một cách an toàn và chống lỗi:
    1. Trích xuất nội dung từ khối ```json ... ``` hoặc ``` ... ``` nếu có văn bản dẫn nhập.
    2. Định vị chính xác từ cặp ngoặc nhọn { ... } ngoài cùng.
    3. Thử parse với strict=False để bỏ qua lỗi ký tự điều khiển/xuống dòng thô trong chuỗi JSON.
    4. Tự động loại bỏ dấu phẩy thừa (trailing commas: ,} hoặc ,]).
    5. Xử lý chuẩn hóa ký tự xuống dòng chưa escape trong chuỗi nếu cần.
    """
    if not response_text or not str(response_text).strip():
        raise ValueError("Phản hồi từ AI trống.")
    
    text = str(response_text).strip()
    
    # 1. Trích xuất khối code nếu AI bọc markdown
    code_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    candidate = code_match.group(1).strip() if code_match else text
    
    # 2. Định vị cặp dấu ngoặc nhọn { ... } ngoài cùng
    first_brace = candidate.find("{")
    last_brace = candidate.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = candidate[first_brace:last_brace + 1]
        
    # 3. Lần thử 1: json.loads chuẩn với strict=False (cho phép ký tự xuống dòng thô)
    try:
        return json.loads(candidate, strict=False)
    except Exception:
        pass
        
    # 4. Lần thử 2: Loại bỏ dấu phẩy thừa trước } hoặc ]
    try:
        no_trailing_commas = re.sub(r",\s*([\}\]])", r"\1", candidate)
        return json.loads(no_trailing_commas, strict=False)
    except Exception:
        pass

    # 5. Lần thử 3: Chuẩn hóa ký tự điều khiển trong chuỗi JSON
    try:
        no_trailing_commas = re.sub(r",\s*([\}\]])", r"\1", candidate)
        fixed_ctrl = re.sub(
            r'[\x00-\x1f\x7f-\x9f]', 
            lambda m: '\\n' if m.group(0) in ('\n', '\r') else ('\\t' if m.group(0) == '\t' else ''), 
            no_trailing_commas
        )
        return json.loads(fixed_ctrl, strict=False)
    except Exception as e:
        print(f"[!] Lỗi phân tích JSON từ AI: {e}\n[!] Văn bản phản hồi thô:\n{text[:500]}")
        raise e


def find_duplicate_invoice(
    user_id: int,
    total_amount: float,
    store_name: str,
    date: str,
    items: list = None,
    current_invoice_id: str = None,
    store_address: str = None,
    invoice_type: str = None
) -> Optional[dict]:
    """
    Tìm kiếm hóa đơn/chứng từ/tài liệu trùng lặp thông minh:
    1. Lấy tất cả hóa đơn của user có cùng số tiền (khi total_amount > 0) hoặc cùng user_id.
    2. Không phân biệt chữ hoa/thường, so khớp mờ tên quán/tiêu đề tài liệu (VD: 'AEON' vs 'AEON Glam Beautique' hoặc 'PHIẾU ĐĂNG KÝ...').
    3. So khớp ngày tháng, địa chỉ/người ký, và danh sách mặt hàng / trường thông tin chi tiết.
    4. Trả về dict hóa đơn/tài liệu trùng lặp (kể cả đang hoạt động, bản nháp, hoặc đang ở Thùng rác).
    """
    from database import client

    try:
        total_amount = float(round(float(total_amount or 0.0)))
    except (ValueError, TypeError):
        total_amount = 0.0

    store_clean = (store_name or "").strip().lower()
    date_clean = (date or "").strip()
    addr_clean = (store_address or "").strip().lower()
    type_clean = (invoice_type or "").strip()

    fields = [
        "invoice_id",
        "store_name",
        "store_address",
        "date",
        "total_amount",
        "invoice_type",
        "is_deleted",
        "is_submitted",
        "hasItems {... on InvoiceItem { item_name total_price }}"
    ]

    if total_amount > 0:
        where = {
            "operator": "And",
            "operands": [
                {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id},
                {"path": ["total_amount"], "operator": "Equal", "valueNumber": total_amount}
            ]
        }
    else:
        where = {
            "path": ["user_id"], "operator": "Equal", "valueNumber": user_id
        }

    try:
        res = client.query.get("Invoice", fields).with_where(where).with_limit(50).do()
        candidates = res.get("data", {}).get("Get", {}).get("Invoice", []) or []
        # Ưu tiên đối chiếu với chứng từ đang hoạt động (chưa xóa) và đã được xác nhận (is_submitted=True)
        candidates.sort(key=lambda c: (not c.get("is_deleted", False), bool(c.get("is_submitted", False))), reverse=True)
    except Exception as e:
        print(f"[!] Lỗi khi truy vấn trùng lặp Weaviate: {e}")
        return None

    new_item_names = set()
    for it in (items or []):
        if isinstance(it, dict):
            name = str(it.get("item_name") or it.get("name") or "").strip().lower()
        else:
            name = str(getattr(it, "item_name", None) or getattr(it, "name", None) or "").strip().lower()
        if name:
            new_item_names.add(name)

    for cand in candidates:
        cid = cand.get("invoice_id", "")
        if current_invoice_id and cid == current_invoice_id:
            continue

        c_store = (cand.get("store_name") or "").strip().lower()
        c_addr = (cand.get("store_address") or "").strip().lower()
        c_date = (cand.get("date") or "").strip()
        c_type = (cand.get("invoice_type") or "").strip()
        c_total = float(round(float(cand.get("total_amount", 0.0) or 0.0)))

        c_items = cand.get("hasItems") or []
        c_item_names = set()
        for it in c_items:
            if isinstance(it, dict):
                name = str(it.get("item_name") or it.get("name") or "").strip().lower()
            else:
                name = str(getattr(it, "item_name", None) or getattr(it, "name", None) or "").strip().lower()
            if name:
                c_item_names.add(name)

        # Đếm số lượng trường thông tin trùng nhau (khớp chính xác hoặc chứa nhau)
        exact_shared = new_item_names & c_item_names
        partial_shared_count = 0
        if not exact_shared:
            for n1 in new_item_names:
                if len(n1) >= 8 and any(n1 in n2 or n2 in n1 for n2 in c_item_names if len(n2) >= 8):
                    partial_shared_count += 1
        total_shared_items = len(exact_shared) + partial_shared_count
        has_shared_items = total_shared_items > 0

        same_date = bool(not date_clean or not c_date or date_clean == c_date)

        store_words_new = set(re.findall(r"\w+", store_clean))
        store_words_cand = set(re.findall(r"\w+", c_store))
        common_words = store_words_new & store_words_cand

        store_overlap = bool(
            store_clean and c_store and (
                store_clean == c_store
                or (len(store_clean) >= 6 and store_clean in c_store)
                or (len(c_store) >= 6 and c_store in store_clean)
                or len(common_words) >= 3
                or (len(store_words_new) > 0 and len(common_words) / len(store_words_new) >= 0.5)
            )
        )

        addr_match = bool(
            addr_clean and c_addr and (
                addr_clean == c_addr
                or (len(addr_clean) >= 4 and addr_clean in c_addr)
                or (len(c_addr) >= 4 and c_addr in addr_clean)
            )
        )

        # 1. Hóa đơn thương mại có số tiền > 0
        if total_amount > 0 and c_total == total_amount:
            # Cùng ngày + (cùng quán hoặc cùng tên món)
            if same_date and (store_overlap or has_shared_items):
                return cand
            # Trùng quán + trùng món
            if store_overlap and has_shared_items:
                return cand
            # Trùng ngày + cùng số tiền (đặc biệt khi số tiền lẻ như 48.800đ)
            if same_date and date_clean and c_date:
                return cand

        # 2. Tài liệu / Biểu mẫu hoặc chứng từ 0đ (FUNSD / Administrative Documents):
        is_doc = (
            type_clean == "Document/Form"
            or c_type == "Document/Form"
            or (total_amount == 0 and c_total == 0)
        )
        if is_doc:
            # a) Trùng tiêu đề (hoặc chứa nhau) kết hợp cùng ngày, hoặc cùng người đăng ký, hoặc trùng trường dữ liệu
            if store_overlap and (same_date or has_shared_items or addr_match):
                return cand
            # b) Trùng từ 2 trường dữ liệu chi tiết trở lên (như cùng MSSV, Họ tên, Mã hồ sơ)
            if total_shared_items >= 2:
                return cand
            # c) Cùng người ký/địa chỉ và cùng ngày và có trường dữ liệu tương đồng
            if addr_match and same_date and (store_overlap or has_shared_items):
                return cand
            # d) Tiêu đề khớp chính xác 100%
            if store_clean and c_store and store_clean == c_store and same_date:
                return cand

    return None

# ==========================================
# --- API ĐỢT 4 & MỞ RỘNG: PIPELINE TRÍCH XUẤT BATCH ---
# ==========================================

@router.post("/api/extract-batch", response_model=BatchInvoiceResponse, tags=["Invoice Processing"])
async def extract_invoice_batch(files: List[UploadFile] = File(...), current_user: dict = Depends(get_current_user)):
    successful_invoices = []
    errors = []
    
    for file in files:
        try:
            print(f"\n[*] Đang xử lý file: {file.filename}...")
            image_bytes = await file.read()
            ocr_text = extract_text_from_image(image_bytes)
            
            if not ocr_text.strip():
                errors.append(f"{file.filename}: OCR không đọc được chữ.")
                continue
            
            prompt = build_invoice_prompt(ocr_text)
            mime_type = file.content_type if file.content_type and file.content_type.startswith("image/") else "image/jpeg"
            response_text = call_llm_with_retry(prompt, image_bytes=image_bytes, mime_type=mime_type, response_mime_type="application/json")
            parsed_json = parse_llm_json_response(response_text)
            
            # Hậu xử lý & chuẩn hóa loại bỏ ảo giác
            parsed_json = normalize_invoice_extracted_data(parsed_json, ocr_text)
            if detect_multiple_invoices(parsed_json):
                errors.append(f"{file.filename}: {MULTI_INVOICE_ERROR}")
                continue
            if parsed_json.get("raw_text_enriched"):
                ocr_text = parsed_json["raw_text_enriched"]
            
            new_invoice_id = f"INV_{str(uuid.uuid4())[:8].upper()}"
            file_extension = file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'jpg'
            saved_image_path = f"uploads/{new_invoice_id}.{file_extension}"

            final_data = InvoiceData(
                invoice_id=new_invoice_id, 
                ocr_confidence=0.95, 
                store_name=parsed_json.get("store_name", ""),
                store_address=parsed_json.get("store_address", ""),
                date=parsed_json.get("date", ""),
                invoice_type=parsed_json.get("invoice_type", "Other"),
                subtotal=float(parsed_json.get("subtotal", 0.0) or 0.0),
                total_amount=float(parsed_json.get("total_amount", 0.0) or 0.0),
                tax_amount=float(parsed_json.get("tax_amount", 0.0) or 0.0),
                items=parsed_json.get("items", []),
                raw_text=ocr_text,
                image_path=saved_image_path,
                is_submitted=True
            )

            # Đợt 9: Chống upload trùng lặp hóa đơn/tài liệu (so khớp mờ thông minh)
            dup = find_duplicate_invoice(
                user_id=current_user["id"],
                total_amount=final_data.total_amount,
                store_name=final_data.store_name,
                date=final_data.date,
                items=final_data.items,
                store_address=final_data.store_address,
                invoice_type=final_data.invoice_type
            )
            if dup:
                dup_id = dup.get("invoice_id", "")
                status_suffix = " (đang nằm trong Thùng rác)" if dup.get("is_deleted") else ""
                item_label = "Tài liệu" if (final_data.invoice_type == "Document/Form" or dup.get("invoice_type") == "Document/Form") else "Hóa đơn"
                errors.append(f"{file.filename}: {item_label} này đã tồn tại rồi!{status_suffix} (Trùng với mã: {dup_id})")
                continue

            os.makedirs("uploads", exist_ok=True)
            with open(saved_image_path, "wb") as f_img:
                f_img.write(image_bytes)

            save_invoice(final_data, user_id=current_user["id"], is_submitted=True)
            successful_invoices.append(final_data)
            
            time.sleep(1)
            
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")
            
    return BatchInvoiceResponse(
        status=200 if successful_invoices else 500, 
        message=f"Xử lý thành công {len(successful_invoices)}/{len(files)} hóa đơn.", 
        data=successful_invoices,
        errors=errors
    )

# ==========================================
# --- API ĐỢT 8: QUẢN LÝ CRUD HÓA ĐƠN ---
# ==========================================

@router.get("/api/invoices", tags=["Invoice CRUD"], summary="Lấy danh sách hóa đơn hoặc tra cứu theo invoice_id")
async def get_invoices(
    invoice_id: Optional[str] = None,
    min_amount: Optional[float] = None, 
    max_amount: Optional[float] = None, 
    current_user: dict = Depends(get_current_user)
):
    """API hỗ trợ hiển thị HistoryListView hoặc lấy chi tiết theo invoice_id"""
    if invoice_id:
        inv = get_invoice_by_id(invoice_id, user_id=current_user["id"])
        if not inv:
            return {"status": 404, "message": "Không tìm thấy hóa đơn", "data": []}
        if "hasItems" in inv and inv["hasItems"]:
            inv["items"] = [item for item in inv["hasItems"] if item.get("item_name")]
        else:
            inv["items"] = []
        return {"status": 200, "message": "Thành công", "data": [inv]}
        
    data = get_filtered_invoices(min_amount=min_amount, max_amount=max_amount, user_id=current_user["id"])
    return {"status": 200, "message": "Thành công", "data": data}


# --- CÁC ROUTE TĨNH ĐẶT TRƯỚC ROUTE ĐỘNG {invoice_id} ---

class BatchInvoiceIdsRequest(BaseModel):
    invoice_ids: List[str]


@router.get("/api/invoices/trash", tags=["Invoice CRUD"], summary="Lấy danh sách thùng rác")
async def get_trash_api(current_user: dict = Depends(get_current_user)):
    data = get_trash_invoices(user_id=current_user["id"])
    return {"status": 200, "message": "Thành công", "data": data}


@router.delete("/api/invoices/trash/empty", tags=["Invoice CRUD"], summary="Dọn sạch thùng rác (Xóa tất cả vĩnh viễn)")
async def empty_trash_api(current_user: dict = Depends(get_current_user)):
    count = empty_trash_invoices(user_id=current_user["id"])
    return {"status": 200, "message": f"Đã xóa vĩnh viễn toàn bộ {count} hóa đơn trong thùng rác."}


@router.post("/api/invoices/trash/batch-delete", tags=["Invoice CRUD"], summary="Xóa vĩnh viễn các hóa đơn đã chọn")
async def batch_delete_trash_api(request: BatchInvoiceIdsRequest, current_user: dict = Depends(get_current_user)):
    count = batch_delete_invoices_completely(request.invoice_ids, user_id=current_user["id"])
    return {"status": 200, "message": f"Đã xóa vĩnh viễn {count} hóa đơn đã chọn."}


@router.post("/api/invoices/trash/batch-restore", tags=["Invoice CRUD"], summary="Khôi phục các hóa đơn đã chọn")
async def batch_restore_trash_api(request: BatchInvoiceIdsRequest, current_user: dict = Depends(get_current_user)):
    count = batch_restore_invoices(request.invoice_ids, user_id=current_user["id"])
    return {"status": 200, "message": f"Đã khôi phục thành công {count} hóa đơn."}


@router.get("/api/invoices/export", tags=["Invoice CRUD"], summary="Xuất danh sách hóa đơn ra file CSV")
async def export_invoices_api(
    from_date: Optional[str] = None, 
    to_date: Optional[str] = None, 
    current_user: dict = Depends(get_current_user)
):
    import pandas as pd
    from fastapi.responses import StreamingResponse
    import io
    
    data = get_filtered_invoices(user_id=current_user["id"])
    
    if from_date or to_date:
        filtered_data = []
        for inv in data:
            inv_date = inv.get("date", "")
            if not inv_date:
                continue
            
            try:
                if "/" in inv_date:
                    d, m, y = inv_date.split("/")
                    inv_date_iso = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
                else:
                    inv_date_iso = inv_date
                    
                if from_date and inv_date_iso < from_date[:10]:
                    continue
                if to_date and inv_date_iso > to_date[:10]:
                    continue
                filtered_data.append(inv)
            except Exception:
                filtered_data.append(inv)
        data = filtered_data
    
    if not data:
        raise HTTPException(status_code=404, detail="Không có hóa đơn nào trong khoảng thời gian này.")
        
    df = pd.DataFrame(data)
    
    columns_to_keep = ["invoice_id", "store_name", "date", "total_amount"]
    df = df[[c for c in columns_to_keep if c in df.columns]]
    
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=invoices_export.csv"
    return response


# --- CÁC ROUTE ĐỘNG THEO {invoice_id} ---

@router.get("/api/invoices/{invoice_id}", tags=["Invoice CRUD"], summary="Lấy chi tiết một hóa đơn theo ID")
async def get_single_invoice_api(invoice_id: str, current_user: dict = Depends(get_current_user)):
    inv = get_invoice_by_id(invoice_id, user_id=current_user["id"])
    if not inv:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy hóa đơn với ID: {invoice_id}")
    if "hasItems" in inv and inv["hasItems"]:
        inv["items"] = [item for item in inv["hasItems"] if item.get("item_name")]
    else:
        inv["items"] = []
    return {"status": 200, "message": "Thành công", "data": inv}


@router.delete("/api/invoices/{invoice_id}", tags=["Invoice CRUD"], summary="Xóa tạm thời (vào thùng rác)")
async def delete_invoice_api(
    invoice_id: str,
    reason: Optional[str] = "Không rõ lý do",
    current_user: dict = Depends(get_current_user)
):
    """Xóa tạm thời hóa đơn vào thùng rác kèm lý do xóa"""
    soft_delete_invoice(invoice_id, user_id=current_user["id"], delete_reason=reason or "Không rõ lý do")
    return {"status": 200, "message": f"Đã chuyển hóa đơn {invoice_id} vào thùng rác."}


@router.post("/api/invoices/{invoice_id}/restore", tags=["Invoice CRUD"], summary="Khôi phục hóa đơn")
async def restore_invoice_api(invoice_id: str, current_user: dict = Depends(get_current_user)):
    restore_invoice(invoice_id, user_id=current_user["id"])
    return {"status": 200, "message": f"Đã khôi phục hóa đơn {invoice_id}."}


@router.delete("/api/invoices/{invoice_id}/permanent", tags=["Invoice CRUD"], summary="Xóa vĩnh viễn")
async def permanent_delete_invoice_api(invoice_id: str, current_user: dict = Depends(get_current_user)):
    delete_invoice_completely(invoice_id, user_id=current_user["id"])
    return {"status": 200, "message": f"Đã xóa vĩnh viễn hóa đơn {invoice_id}."}


@router.put("/api/invoices/{invoice_id}", tags=["Invoice CRUD"], summary="Cập nhật kết quả OCR/AI hoặc chỉnh sửa hóa đơn/tài liệu")
@router.post("/api/invoices/{invoice_id}/submit", tags=["Invoice CRUD"], summary="Xác nhận và lưu hóa đơn/tài liệu")
async def update_invoice_api(invoice_id: str, updated_data: InvoiceData, current_user: dict = Depends(get_current_user)):
    """
    Cho phép người dùng kiểm tra, chỉnh sửa và xóa bớt các trường thông tin / mặt hàng
    ở cả bước Review lẫn trong trang Chi tiết chứng từ.
    """
    existing = get_invoice_by_id(invoice_id, user_id=current_user["id"])

    # Làm tròn tiền tệ VNĐ tự động để không bắt user phải làm tròn tay
    updated_data.total_amount = float(round(float(updated_data.total_amount or 0.0)))
    if updated_data.tax_amount is not None:
        updated_data.tax_amount = float(round(float(updated_data.tax_amount or 0.0)))
    elif existing and existing.get("tax_amount"):
        updated_data.tax_amount = float(round(float(existing.get("tax_amount") or 0.0)))
    else:
        updated_data.tax_amount = 0.0
    updated_data.subtotal = float(round(max(0.0, updated_data.total_amount - updated_data.tax_amount)))

    # Kiểm tra trùng lặp với hóa đơn ĐÃ XÁC NHẬN khác khi submit lần đầu
    if not (existing and existing.get("is_submitted") is True):
        dup = find_duplicate_invoice(
            user_id=current_user["id"],
            total_amount=updated_data.total_amount,
            store_name=updated_data.store_name,
            date=updated_data.date,
            items=updated_data.items,
            current_invoice_id=invoice_id,
            store_address=updated_data.store_address,
            invoice_type=updated_data.invoice_type
        )
        if dup and (dup.get("is_submitted") is True or not dup.get("is_deleted")):
            dup_id = dup.get("invoice_id", "")
            item_label = "Tài liệu / Biểu mẫu" if (updated_data.invoice_type == "Document/Form" or dup.get("invoice_type") == "Document/Form") else "Hóa đơn"
            raise HTTPException(
                status_code=400,
                detail=f"{item_label} này đã tồn tại rồi! (Trùng thông tin với mã: {dup_id})"
            )

    updated_data.invoice_id = invoice_id
    updated_data.is_submitted = True
    if not updated_data.image_path:
        if existing and existing.get("image_path"):
            updated_data.image_path = existing.get("image_path")
        else:
            for ext in ("jpg", "png", "jpeg", "webp"):
                cand = f"uploads/{invoice_id}.{ext}"
                if os.path.exists(cand):
                    updated_data.image_path = cand
                    break
    if not updated_data.raw_text and existing and existing.get("raw_text"):
        updated_data.raw_text = existing.get("raw_text")
        
    if existing:
        delete_invoice_completely(invoice_id, user_id=current_user["id"], delete_file=False)
    
    try:
        save_invoice(updated_data, user_id=current_user["id"], is_submitted=True)
        return {
            "status": 200, 
            "message": "Xác nhận và lưu hóa đơn thành công!", 
            "data": updated_data.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu hóa đơn: {str(e)}")


# ==========================================
# --- API ANALYZE INVOICE (ĐƠN FILE) ---
# Endpoint này được Frontend gọi sau khi user chụp/chọn ảnh hóa đơn.
# Khác với /api/extract-batch (nhiều file), endpoint này xử lý 1 file duy nhất,
# yêu cầu JWT và trả về InvoiceData để user kiểm tra, chỉnh sửa trước khi Submit.
# ==========================================

@router.post("/api/analyze-invoice", response_model=None, tags=["Invoice Processing"], 
             summary="Phân tích 1 ảnh hóa đơn đơn lẻ (có xác thực JWT)")
async def analyze_single_invoice(
    file: UploadFile = File(...),
    force_overwrite: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Pipeline: Nhận ảnh → OCR (PaddleOCR) → Trích xuất JSON (Gemini) → Hậu xử lý chuẩn hóa → Lưu tạm Vector DB.
    Trả về dữ liệu hóa đơn cho bước Kiểm tra & Chỉnh sửa (Review) của Frontend trước khi Submit.
    """
    try:
        print(f"\n[*] Đang phân tích hóa đơn cho user: {current_user['username']}...")
        image_bytes = await file.read()
        ocr_text = extract_text_from_image(image_bytes)
        
        if not ocr_text.strip():
            raise HTTPException(status_code=422, detail="Không nhận diện được chữ trên ảnh. Vui lòng chụp lại rõ hơn.")
        
        prompt = build_invoice_prompt(ocr_text)
        mime_type = file.content_type if file.content_type and file.content_type.startswith("image/") else "image/jpeg"
        response_text = call_llm_with_retry(prompt, image_bytes=image_bytes, mime_type=mime_type, response_mime_type="application/json")
        parsed_json = parse_llm_json_response(response_text)
        
        # Áp dụng hậu xử lý & chuẩn hóa loại bỏ hoàn toàn ảo giác
        parsed_json = normalize_invoice_extracted_data(parsed_json, ocr_text)

        # Chặn ngay nếu 1 bức ảnh chứa từ 2 hóa đơn trở lên (KHÔNG lưu vào DB)
        if detect_multiple_invoices(parsed_json):
            print(f"[!] Phát hiện {parsed_json.get('detected_invoice_count')} chứng từ trong 1 ảnh -> yêu cầu cắt ảnh.")
            raise HTTPException(status_code=400, detail=MULTI_INVOICE_ERROR)

        if parsed_json.get("raw_text_enriched"):
            ocr_text = parsed_json["raw_text_enriched"]

        new_invoice_id = f"INV_{str(uuid.uuid4())[:8].upper()}"
        file_extension = file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'jpg'
        saved_image_path = f"uploads/{new_invoice_id}.{file_extension}"

        final_data = InvoiceData(
            invoice_id=new_invoice_id,
            ocr_confidence=0.95,
            store_name=parsed_json.get("store_name", ""),
            store_address=parsed_json.get("store_address", ""),
            date=parsed_json.get("date", ""),
            invoice_type=parsed_json.get("invoice_type", "Other"),
            subtotal=float(parsed_json.get("subtotal", 0.0) or 0.0),
            total_amount=float(parsed_json.get("total_amount", 0.0) or 0.0),
            tax_amount=float(parsed_json.get("tax_amount", 0.0) or 0.0),
            items=parsed_json.get("items", []),
            raw_text=ocr_text,
            image_path=saved_image_path,
            is_submitted=False
        )

        # Chống trùng lặp TRƯỚC khi lưu ảnh vật lý xuống đĩa để không sinh file ảnh rác
        dup = find_duplicate_invoice(
            user_id=current_user["id"],
            total_amount=final_data.total_amount,
            store_name=final_data.store_name,
            date=final_data.date,
            items=final_data.items,
            store_address=final_data.store_address,
            invoice_type=final_data.invoice_type
        )
        if dup:
            dup_id = dup.get("invoice_id", "")
            c_store = dup.get("store_name", "") or final_data.store_name
            c_date = dup.get("date", "") or final_data.date
            is_in_trash = bool(dup.get("is_deleted"))
            
            if force_overwrite:
                delete_invoice_completely(dup_id, user_id=current_user["id"])
                print(f"[*] Force overwrite: Đã xóa chứng từ trùng lặp cũ {dup_id}")
            else:
                status_suffix = " (đang nằm trong Thùng rác)" if is_in_trash else ""
                is_doc_dup = (
                    final_data.invoice_type == "Document/Form" 
                    or dup.get("invoice_type") == "Document/Form" 
                    or (final_data.total_amount == 0 and float(dup.get("total_amount", 0) or 0) == 0)
                )
                if is_doc_dup:
                    dup_msg = (
                        f"Tài liệu này đã tồn tại rồi!{status_suffix} "
                        f"(Trùng tiêu đề '{c_store}', ngày {c_date} - Mã: {dup_id})"
                    )
                else:
                    dup_msg = (
                        f"Hóa đơn này đã tồn tại rồi!{status_suffix} "
                        f"(Trùng tên quán '{c_store}', ngày {c_date}, số tiền {final_data.total_amount:,.0f}đ - Mã: {dup_id})"
                    )
                print(f"[!] Phát hiện trùng lặp: {dup_msg}")
                raise HTTPException(status_code=400, detail=dup_msg)

        # Lưu ảnh vật lý sau khi đã qua bước kiểm tra trùng lặp
        os.makedirs("uploads", exist_ok=True)
        with open(saved_image_path, "wb") as f_img:
            f_img.write(image_bytes)

        # Lưu tạm với trạng thái is_submitted=False
        save_invoice(final_data, user_id=current_user["id"], is_submitted=False)

        resp_dict = final_data.dict()
        is_doc = final_data.invoice_type == "Document/Form"

        return {
            "status": 200,
            "message": (
                "Phân tích tài liệu thành công! Vui lòng kiểm tra lại thông tin trước khi xác nhận."
                if is_doc else
                "Phân tích hóa đơn thành công! Vui lòng kiểm tra lại thông tin trước khi xác nhận."
            ),
            "data": resp_dict
        }
        
    except HTTPException:
        raise
    except json.JSONDecodeError as jde:
        print(f"[!] JSONDecodeError trong analyze_single_invoice: {jde}")
        raise HTTPException(status_code=500, detail="AI không trả về JSON hợp lệ. Vui lòng thử lại.")
    except Exception as e:
        print(f"[!] Exception trong analyze_single_invoice: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích hóa đơn: {str(e)}")
