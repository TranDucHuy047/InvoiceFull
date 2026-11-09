from pydantic import BaseModel
import os
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
            response_text = call_llm_with_retry(prompt, image_bytes=image_bytes, mime_type=mime_type)
            clean_text = response_text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            elif clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()
            parsed_json = json.loads(clean_text)
            
            # Hậu xử lý & chuẩn hóa loại bỏ ảo giác
            parsed_json = normalize_invoice_extracted_data(parsed_json, ocr_text)
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

            # Đợt 9: Chống upload trùng lặp hóa đơn
            from database import client
            
            where_operands = [
                {"path": ["user_id"], "operator": "Equal", "valueNumber": current_user["id"]},
                {"path": ["is_deleted"], "operator": "Equal", "valueBoolean": False},
                {"path": ["total_amount"], "operator": "Equal", "valueNumber": final_data.total_amount}
            ]
            if final_data.store_name and final_data.store_name.strip():
                where_operands.append({"path": ["store_name"], "operator": "Equal", "valueText": final_data.store_name.strip()})
            if final_data.date and final_data.date.strip():
                where_operands.append({"path": ["date"], "operator": "Equal", "valueText": final_data.date.strip()})
            
            duplicate_query = client.query.get("Invoice", ["invoice_id"]).with_where({"operator": "And", "operands": where_operands}).with_limit(1).do()
            dup_invoices = duplicate_query.get("data", {}).get("Get", {}).get("Invoice", [])
            if dup_invoices:
                dup_id = dup_invoices[0].get("invoice_id", "")
                errors.append(f"{file.filename}: Hóa đơn này đã tồn tại rồi! (Trùng với mã: {dup_id})")
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


@router.put("/api/invoices/{invoice_id}", tags=["Invoice CRUD"], summary="Cập nhật kết quả OCR/AI trước khi submit")
@router.post("/api/invoices/{invoice_id}/submit", tags=["Invoice CRUD"], summary="Xác nhận và khóa hóa đơn")
async def update_invoice_api(invoice_id: str, updated_data: InvoiceData, current_user: dict = Depends(get_current_user)):
    """
    Cho phép người dùng kiểm tra và sửa lại thông tin ở bước Review trước khi Submit.
    Nếu hóa đơn đã được submit trước đó, KHÔNG THỂ chỉnh sửa nữa (trả về lỗi 400).
    Khi submit thành công, hóa đơn được khóa vĩnh viễn (is_submitted = True).
    """
    existing = get_invoice_by_id(invoice_id, user_id=current_user["id"])
    if existing and existing.get("is_submitted") is True:
        raise HTTPException(
            status_code=400, 
            detail="Hóa đơn này đã được xác nhận (submit) và không thể chỉnh sửa nữa."
        )

    # Làm tròn tiền tệ VNĐ tự động để không bắt user phải làm tròn tay
    updated_data.total_amount = float(round(float(updated_data.total_amount or 0.0)))
    if updated_data.tax_amount is not None:
        updated_data.tax_amount = float(round(float(updated_data.tax_amount or 0.0)))
    elif existing and existing.get("tax_amount"):
        updated_data.tax_amount = float(round(float(existing.get("tax_amount") or 0.0)))
    else:
        updated_data.tax_amount = 0.0
    updated_data.subtotal = float(round(max(0.0, updated_data.total_amount - updated_data.tax_amount)))

    # Kiểm tra trùng lặp với hóa đơn ĐÃ XÁC NHẬN khác khi submit
    from database import client
    dup_where = [
        {"path": ["user_id"], "operator": "Equal", "valueNumber": current_user["id"]},
        {"path": ["is_deleted"], "operator": "Equal", "valueBoolean": False},
        {"path": ["is_submitted"], "operator": "Equal", "valueBoolean": True},
        {"path": ["invoice_id"], "operator": "NotEqual", "valueString": invoice_id},
        {"path": ["total_amount"], "operator": "Equal", "valueNumber": updated_data.total_amount}
    ]
    if updated_data.store_name and updated_data.store_name.strip():
        dup_where.append({"path": ["store_name"], "operator": "Equal", "valueText": updated_data.store_name.strip()})
    if updated_data.date and updated_data.date.strip():
        dup_where.append({"path": ["date"], "operator": "Equal", "valueText": updated_data.date.strip()})
        
    dup_check = client.query.get("Invoice", ["invoice_id"]).with_where({"operator": "And", "operands": dup_where}).with_limit(1).do()
    existing_dups = (dup_check.get("data") or {}).get("Get", {}).get("Invoice") or []
    if existing_dups:
        dup_id = existing_dups[0].get("invoice_id", "")
        raise HTTPException(
            status_code=400,
            detail=f"Hóa đơn này đã tồn tại rồi! (Trùng thông tin với mã hóa đơn: {dup_id})"
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
        response_text = call_llm_with_retry(prompt, image_bytes=image_bytes, mime_type=mime_type)
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        elif clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()
        parsed_json = json.loads(clean_text)
        
        # Áp dụng hậu xử lý & chuẩn hóa loại bỏ hoàn toàn ảo giác
        parsed_json = normalize_invoice_extracted_data(parsed_json, ocr_text)
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
        from database import client
        
        where_operands = [
            {"path": ["user_id"], "operator": "Equal", "valueNumber": current_user["id"]},
            {"path": ["is_deleted"], "operator": "Equal", "valueBoolean": False},
            {"path": ["total_amount"], "operator": "Equal", "valueNumber": final_data.total_amount}
        ]
        if final_data.store_name and final_data.store_name.strip():
            where_operands.append({"path": ["store_name"], "operator": "Equal", "valueText": final_data.store_name.strip()})
        if final_data.date and final_data.date.strip():
            where_operands.append({"path": ["date"], "operator": "Equal", "valueText": final_data.date.strip()})
        
        duplicate_query = client.query.get("Invoice", ["invoice_id"]).with_where({"operator": "And", "operands": where_operands}).with_limit(5).do()
        dup_invoices = duplicate_query.get("data", {}).get("Get", {}).get("Invoice", [])
        if dup_invoices:
            if force_overwrite:
                for dup_inv in dup_invoices:
                    dup_id = dup_inv.get("invoice_id", "")
                    if dup_id:
                        delete_invoice_completely(dup_id, user_id=current_user["id"])
                        print(f"[*] Force overwrite: Đã xóa hóa đơn trùng lặp cũ {dup_id}")
            else:
                dup_id = dup_invoices[0].get("invoice_id", "")
                dup_msg = f"Hóa đơn này đã tồn tại rồi! (Trùng tên quán '{final_data.store_name}', ngày {final_data.date}, số tiền {final_data.total_amount:,.0f}đ - Mã: {dup_id})"
                print(f"[!] Phát hiện trùng lặp: {dup_msg}")
                raise HTTPException(status_code=400, detail=dup_msg)

        # Lưu ảnh vật lý sau khi đã qua bước kiểm tra trùng lặp
        os.makedirs("uploads", exist_ok=True)
        with open(saved_image_path, "wb") as f_img:
            f_img.write(image_bytes)

        # Lưu tạm với trạng thái is_submitted=False
        save_invoice(final_data, user_id=current_user["id"], is_submitted=False)

        # Kiểm tra nếu trong 1 bức ảnh AI phát hiện có > 1 tờ hóa đơn độc lập (sub_invoices)
        raw_subs = parsed_json.get("sub_invoices")
        multiple_list = []
        if isinstance(raw_subs, list) and len(raw_subs) > 1:
            multiple_list.append(final_data.dict())
            for sub in raw_subs[1:]:
                if not isinstance(sub, dict):
                    continue
                norm_sub = normalize_invoice_extracted_data(sub, ocr_text)
                sub_id = f"INV_{str(uuid.uuid4())[:8].upper()}"
                sub_img_path = f"uploads/{sub_id}.{file_extension}"
                with open(sub_img_path, "wb") as f_sub:
                    f_sub.write(image_bytes)
                sub_data = InvoiceData(
                    invoice_id=sub_id,
                    ocr_confidence=0.95,
                    store_name=norm_sub.get("store_name", ""),
                    store_address=norm_sub.get("store_address", ""),
                    date=norm_sub.get("date", ""),
                    invoice_type=norm_sub.get("invoice_type", "Other"),
                    subtotal=float(norm_sub.get("subtotal", 0.0) or 0.0),
                    total_amount=float(norm_sub.get("total_amount", 0.0) or 0.0),
                    tax_amount=float(norm_sub.get("tax_amount", 0.0) or 0.0),
                    items=norm_sub.get("items", []),
                    raw_text=norm_sub.get("raw_text_enriched") or ocr_text,
                    image_path=sub_img_path,
                    is_submitted=False
                )
                save_invoice(sub_data, user_id=current_user["id"], is_submitted=False)
                multiple_list.append(sub_data.dict())

        resp_dict = final_data.dict()
        if len(multiple_list) > 1:
            resp_dict["multiple_invoices"] = multiple_list

        return {
            "status": 200,
            "message": "Phân tích hóa đơn thành công! Vui lòng kiểm tra lại thông tin trước khi xác nhận.",
            "data": resp_dict
        }
        
    except HTTPException:
        raise
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI không trả về JSON hợp lệ. Vui lòng thử lại.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích hóa đơn: {str(e)}")
