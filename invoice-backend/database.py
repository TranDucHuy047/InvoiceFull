import weaviate
import os

# Lấy URL từ biến môi trường (nếu chạy Docker), ngược lại fallback về localhost (nếu chạy code chay)
WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://localhost:8080")
client = weaviate.Client(url=WEAVIATE_URL)
import json
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHAT_HISTORY_FILE = os.path.join(BASE_DIR, "chat_history.json")

def load_chat_history():
    if os.path.exists(CHAT_HISTORY_FILE):
        try:
            with open(CHAT_HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading chat history: {e}")
    return {}

def save_chat_history():
    try:
        with open(CHAT_HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(chat_history_db, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving chat history: {e}")

chat_history_db = load_chat_history()

def setup_database():
    """Khởi tạo cấu trúc Schema Parent/Child cho Hierarchical Chunking.
    Chỉ tạo schema khi chưa tồn tại, giữ nguyên dữ liệu cũ."""
    
    # Nếu schema đã tồn tại → bỏ qua, KHÔNG xóa dữ liệu
    # Nâng cấp schema cho đợt 9: Thêm các thuộc tính mới
    if client.schema.exists("Invoice"):
        try:
            client.schema.property.create("Invoice", {"name": "user_id", "dataType": ["int"]})
            print("[*] Added user_id property")
        except Exception as e:
            pass
        try:
            client.schema.property.create("Invoice", {"name": "is_deleted", "dataType": ["boolean"]})
            print("[*] Added is_deleted property")
        except Exception:
            pass
        try:
            client.schema.property.create("Invoice", {"name": "deleted_at", "dataType": ["date"]})
            print("[*] Added deleted_at property")
        except Exception:
            pass
        try:
            client.schema.property.create("Invoice", {"name": "image_path", "dataType": ["text"]})
            print("[*] Added image_path property")
        except Exception:
            pass

    if client.schema.exists("Invoice") and client.schema.exists("InvoiceItem"):

        print("[*] Log message removed due to unicode")
        return

    # 1. Tạo Schema cho Chunk Con (Từng món hàng) — chỉ khi chưa có
    if not client.schema.exists("InvoiceItem"):
        item_schema = {
            "class": "InvoiceItem",
            "description": "Dữ liệu chi tiết từng món hàng (Chunk con)",
            "properties": [
                {"name": "item_name", "dataType": ["text"]},
                {"name": "quantity", "dataType": ["number"]},
                {"name": "unit_price", "dataType": ["number"]},
                {"name": "total_price", "dataType": ["number"]},
                {"name": "invoice_id_ref", "dataType": ["text"]},
                {"name": "user_id", "dataType": ["number"]}
            ]
        }
        client.schema.create_class(item_schema)
    
    # 2. Tạo Schema cho Chunk Cha (Hóa đơn tổng) — chỉ khi chưa có
    if not client.schema.exists("Invoice"):
        invoice_schema = {
            "class": "Invoice",
            "description": "Dữ liệu tổng thể của hóa đơn (Chunk cha)",
            "properties": [
                {"name": "invoice_id", "dataType": ["text"]},
                {"name": "store_name", "dataType": ["text"]},
                {"name": "date", "dataType": ["text"]},
                                {"name": "total_amount", "dataType": ["number"]},
                {"name": "is_deleted", "dataType": ["boolean"]},
                {"name": "deleted_at", "dataType": ["date"]},
                {"name": "image_path", "dataType": ["text"]},
                {"name": "raw_text", "dataType": ["text"]},
                {
                    "name": "hasItems",
                    "dataType": ["InvoiceItem"],
                    "description": "Liên kết chéo (Cross-reference) đến các món hàng"
                }
            ]
        }
        client.schema.create_class(invoice_schema)
    
    
    
    # Nâng cấp schema cho đợt 9: Thêm user_id vào Invoice
    if client.schema.exists("Invoice"):
        try:
            client.schema.property.create("Invoice", {"name": "user_id", "dataType": ["int"]})
        except Exception as e:
            pass
        try:
            client.schema.property.create("Invoice", {"name": "is_deleted", "dataType": ["boolean"]})
        except Exception:
            pass
        try:
            client.schema.property.create("Invoice", {"name": "deleted_at", "dataType": ["date"]})
        except Exception:
            pass
            
    print("[*] Log message removed due to unicode")


def save_invoice(invoice_data, user_id: int = 0, is_submitted: bool = False):
    """Thuật toán Hierarchical Chunking: Lưu và liên kết vector"""
    
    # Bước 1: Lưu thông tin Cha (Invoice)
    invoice_uuid = client.data_object.create(
        data_object={
            "invoice_id": invoice_data.invoice_id,
            "store_name": invoice_data.store_name,
            "store_address": getattr(invoice_data, "store_address", "") or "",
            "date": invoice_data.date,
            "total_amount": float(invoice_data.total_amount),
            "raw_text": invoice_data.raw_text,
            "user_id": user_id,
            "is_deleted": False,
            "is_submitted": bool(is_submitted or getattr(invoice_data, "is_submitted", False))
        },
        class_name="Invoice"
    )

# Bước 2 & 3: Băm nhỏ từng món hàng (Chunking) và tạo Liên kết (Cross-Reference)
    saved_chunks = 0
    if invoice_data.items:
        for item in invoice_data.items:
            if isinstance(item, dict):
                i_name = str(item.get("item_name", "") or "")
                i_qty = int(item.get("quantity", 1) or 1)
                i_unit = float(item.get("unit_price", 0.0) or 0.0)
                i_total = float(item.get("total_price", 0.0) or 0.0)
            else:
                i_name = str(getattr(item, "item_name", "") or "")
                i_qty = int(getattr(item, "quantity", 1) or 1)
                i_unit = float(getattr(item, "unit_price", 0.0) or 0.0)
                i_total = float(getattr(item, "total_price", 0.0) or 0.0)

            item_uuid = client.data_object.create(
                data_object={
                    "item_name": i_name,
                    "quantity": i_qty,
                    "unit_price": i_unit,
                    "total_price": i_total,
                    "invoice_id_ref": invoice_data.invoice_id,
                    "user_id": user_id
                },
                class_name="InvoiceItem"
            )
            
            # Trỏ mũi tên liên kết từ Cha xuống Con
            client.data_object.reference.add(
                from_class_name="Invoice",
                from_uuid=invoice_uuid,
                from_property_name="hasItems",
                to_class_name="InvoiceItem",
                to_uuid=item_uuid
            )
            saved_chunks += 1
            
    print("[*] Log message removed due to unicode")

def get_invoice_by_id(invoice_id: str, user_id: int = 0):
    """Truy vấn hóa đơn từ Weaviate dựa vào invoice_id kèm liên kết chéo"""
    result = client.query.get(
        "Invoice", ["invoice_id", "store_name", "store_address", "date", "total_amount", "raw_text", "user_id", "is_deleted", "image_path", "is_submitted", "hasItems {... on InvoiceItem { item_name quantity unit_price total_price }}"]
    ).with_where({
        "path": ["invoice_id"],
        "operator": "Equal",
        "valueString": invoice_id
    }).do()
    
    try:
        items = result["data"]["Get"]["Invoice"]
        if items:
            return items[0]
    except Exception as e:
        print("[*] Log message removed due to unicode")
    return None    

# ==========================================
# --- NÂNG CẤP ĐỢT 9: TỐI ƯU KHOẢNG CÁCH VECTOR (DISTANCE THRESHOLD) ---
# ==========================================

def search_relevant_items(question: str, invoice_id: str, limit: int = 3, max_distance: float = 0.65):
    """Đợt 7 & 9: Vector Search Chunk con với ngưỡng khoảng cách lọc nhiễu"""
    try:
        result = client.query.get(
            "InvoiceItem", ["item_name", "quantity", "unit_price", "total_price"]
        ).with_near_text({
            "concepts": [question],
            "distance": max_distance
        }).with_where({
            "path": ["invoice_id_ref"],
            "operator": "Equal",
            "valueString": invoice_id
        }).with_where({"path": ["user_id"], "operator": "Equal", "valueNumber": user_id}).with_limit(limit).do()
        
        return result.get("data", {}).get("Get", {}).get("InvoiceItem", [])
    except Exception as e:
        pass
        return []

def global_search_invoices(search_query: str, limit: int = 15, max_distance: float = 0.7, user_id: int = 0):
    """Đợt 8 & 9: Tìm kiếm hóa đơn bằng Query Expansion + Ngưỡng khoảng cách"""
    try:
        result = client.query.get(
            "Invoice", ["invoice_id", "store_name", "store_address", "date", "total_amount", "image_path", "raw_text"]
        ).with_near_text({
            "concepts": [search_query],
            "distance": max_distance
        }).with_where({"path": ["user_id"], "operator": "Equal", "valueNumber": user_id}).with_limit(limit).do()
        return result.get("data", {}).get("Get", {}).get("Invoice", [])
    except Exception as e:
        pass
        return []

def global_search_items(search_query: str, limit: int = 30, max_distance: float = 0.7, user_id: int = 0):
    """Đợt 8 & 9: Tìm kiếm món hàng bằng Query Expansion + Ngưỡng khoảng cách"""
    try:
        result = client.query.get(
            "InvoiceItem", ["item_name", "quantity", "total_price", "invoice_id_ref"]
        ).with_near_text({
            "concepts": [search_query],
            "distance": max_distance
        }).with_where({"path": ["user_id"], "operator": "Equal", "valueNumber": user_id}).with_limit(limit).do()
        return result.get("data", {}).get("Get", {}).get("InvoiceItem", [])
    except Exception as e:
        pass
        return []

def get_all_active_items_for_user(user_id: int = 0):
    """Lấy danh sách tất cả món hàng từ các hóa đơn chưa bị xóa của user"""
    try:
        where_cond = {
            "operator": "And",
            "operands": [
                {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id},
                {"path": ["is_deleted"], "operator": "NotEqual", "valueBoolean": True}
            ]
        }
        inv_res = client.query.get("Invoice", ["invoice_id", "store_name", "store_address", "date"]).with_where(where_cond).with_limit(200).do()
        invoices = inv_res.get("data", {}).get("Get", {}).get("Invoice", [])
        inv_map = {inv["invoice_id"]: inv for inv in invoices if inv.get("invoice_id")}
        
        if not inv_map:
            return []
            
        item_res = client.query.get("InvoiceItem", ["item_name", "quantity", "unit_price", "total_price", "invoice_id_ref"]).with_where(
            {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id}
        ).with_limit(500).do()
        items = item_res.get("data", {}).get("Get", {}).get("InvoiceItem", [])
        
        active_items = []
        for it in items:
            ref = it.get("invoice_id_ref")
            if ref in inv_map and it.get("item_name") and str(it.get("item_name")).strip():
                parent = inv_map[ref]
                it["store_name"] = parent.get("store_name", "")
                it["store_address"] = parent.get("store_address", "")
                it["date"] = parent.get("date", "")
                active_items.append(it)
                
        # Sắp xếp các món theo giá tiền giảm dần (đắt nhất lên đầu)
        active_items.sort(key=lambda x: float(x.get("total_price", 0.0) or x.get("unit_price", 0.0) or 0.0), reverse=True)
        return active_items
    except Exception as e:
        print(f"[!] Lỗi get_all_active_items_for_user: {e}")
        return []



# ==========================================
# --- NÂNG CẤP: LẤY TẤT CẢ HÓA ĐƠN + SẮP XẾP THEO NGÀY ---
# ==========================================

def get_all_invoices_sorted(descending: bool = True, user_id: int = 0):
    """Lấy tất cả hóa đơn và sắp xếp theo ngày tháng thực tế.
    descending=True: mới nhất trước, descending=False: cũ nhất trước."""
    from datetime import datetime
    import re
    
    try:
        where_cond = {
            "operator": "And",
            "operands": [
                {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id},
                {"path": ["is_deleted"], "operator": "NotEqual", "valueBoolean": True}
            ]
        }
        result = client.query.get(
            "Invoice", ["invoice_id", "store_name", "store_address", "date", "total_amount", "image_path", "raw_text"]
        ).with_additional(["creationTimeUnix"]).with_where(where_cond).with_limit(100).do()
        invoices = result.get("data", {}).get("Get", {}).get("Invoice", [])
    except Exception as e:
        print("[*] Log message removed due to unicode")
        return []
    
    def parse_date(date_str):
        """Parse nhiều định dạng ngày tháng phổ biến trong hóa đơn Việt Nam."""
        if not date_str:
            return datetime.min
        
        # Chuẩn hóa: loại bỏ khoảng trắng thừa
        date_str = date_str.strip()
        
        # Thử các format phổ biến
        formats = [
            "%d/%m/%Y",      # 26/10/2025
            "%d-%m-%Y",      # 26-10-2025
            "%d.%m.%Y",      # 26.10.2025
            "%Y-%m-%d",      # 2025-10-26
            "%Y/%m/%d",      # 2025/10/26
            "%d/%m/%y",      # 26/10/25
            "%d-%m-%y",      # 26-10-25
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        # Fallback: trích xuất ngày tháng bằng regex từ chuỗi phức tạp
        # Ví dụ: "Ngày 26 tháng 10 năm 2025"
        match = re.search(r'(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{2,4})', date_str)
        if match:
            day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            if year < 100:
                year += 2000
            try:
                return datetime(year, month, day)
            except ValueError:
                pass
        
        match = re.search(r'(\d{1,2})\s*[-\.]\s*(\d{1,2})\s*[-\.]\s*(\d{2,4})', date_str)
        if match:
            day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            if year < 100:
                year += 2000
            try:
                return datetime(year, month, day)
            except ValueError:
                pass
        
        print("[*] Log message removed due to unicode")
        return datetime.min
    
    # Sắp xếp theo ngày upload
    invoices.sort(key=lambda inv: int(inv.get("_additional", {}).get("creationTimeUnix", 0)), reverse=descending)
    
    return invoices

# ==========================================
# --- NÂNG CẤP ĐỢT 8: CRUD HÓA ĐƠN (LỌC, XÓA) ---
# ==========================================

def get_filtered_invoices(min_amount: float = None, max_amount: float = None, limit: int = 100, user_id: int = 0):
    """Đợt 8: Truy vấn danh sách hóa đơn, hỗ trợ lọc theo số tiền"""
    
    where_operands = [
        {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id},
        {"path": ["is_deleted"], "operator": "NotEqual", "valueBoolean": True}
    ]

    
    if min_amount is not None:
        where_operands.append({"path": ["total_amount"], "operator": "GreaterThanEqual", "valueNumber": min_amount})
    if max_amount is not None:
        where_operands.append({"path": ["total_amount"], "operator": "LessThanEqual", "valueNumber": max_amount})
        
    query = client.query.get("Invoice", ["invoice_id", "store_name", "store_address", "date", "total_amount", "image_path", "raw_text"])
    
    # Ráp điều kiện lọc (nếu có)
    if len(where_operands) == 1:
        query = query.with_where(where_operands[0])
    elif len(where_operands) > 1:
        query = query.with_where({"operator": "And", "operands": where_operands})
        
    try:
        # NOTE: Using a redundant condition here because the previous code did it, but it works.
        result = query.with_limit(limit).do()
        invoices = result.get("data", {}).get("Get", {}).get("Invoice", [])
        
        # Inject 'id' for frontend compatibility
        for inv in invoices:
            if "invoice_id" in inv:
                inv["id"] = inv["invoice_id"]
                
        return invoices
    except Exception as e:
        print("[*] Log message removed due to unicode")
        return []

def delete_invoice_completely(invoice_id: str, user_id: int = 0):
    """Đợt 8: Xóa triệt để Chunk Cha (Invoice) và Chunk Con (InvoiceItem)"""
    success = False
    
    # 1. Tìm UUID của Chunk Cha
    inv_result = client.query.get("Invoice", ["_additional { id }"]).with_where(
        {"operator": "And", "operands": [
            {"path": ["invoice_id"], "operator": "Equal", "valueString": invoice_id},
            {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id}
        ]}
    ).do()
    
    data = inv_result.get("data")
    if not data:
        return False
        
    inv_uuids = [item["_additional"]["id"] for item in data.get("Get", {}).get("Invoice", [])]
    
    # 2. Xóa Chunk Cha
    for uid in inv_uuids:
        client.data_object.delete(uid, class_name="Invoice")
        success = True
        
    # 3. Tìm UUID của các Chunk Con liên kết
    item_result = client.query.get("InvoiceItem", ["_additional { id }"]).with_where(
        {"path": ["invoice_id_ref"], "operator": "Equal", "valueString": invoice_id}
    ).do()
    
    item_data = item_result.get("data")
    if item_data:
        item_uuids = [item["_additional"]["id"] for item in item_data.get("Get", {}).get("InvoiceItem", [])]
        
        # 4. Xóa Chunk Con
        for uid in item_uuids:
            client.data_object.delete(uid, class_name="InvoiceItem")
            
    return success
from datetime import datetime, timezone

def soft_delete_invoice(invoice_id: str, user_id: int = 0):
    inv_result = client.query.get("Invoice", ["_additional { id }"]).with_where(
        {"operator": "And", "operands": [
            {"path": ["invoice_id"], "operator": "Equal", "valueString": invoice_id},
            {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id}
        ]}
    ).do()
    
    data = inv_result.get("data")
    if not data:
        return False
        
    inv_uuids = [item["_additional"]["id"] for item in data.get("Get", {}).get("Invoice", [])]
    now_iso = datetime.now(timezone.utc).isoformat()
    
    for uid in inv_uuids:
        client.data_object.update(uuid=uid, class_name="Invoice", data_object={
                "is_deleted": True,
                "deleted_at": now_iso
            }
        )
    return True

def restore_invoice(invoice_id: str, user_id: int = 0):
    inv_result = client.query.get("Invoice", ["_additional { id }"]).with_where(
        {"operator": "And", "operands": [
            {"path": ["invoice_id"], "operator": "Equal", "valueString": invoice_id},
            {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id}
        ]}
    ).do()
    
    data = inv_result.get("data")
    if not data:
        return False
        
    inv_uuids = [item["_additional"]["id"] for item in data.get("Get", {}).get("Invoice", [])]
    for uid in inv_uuids:
        client.data_object.update(uuid=uid, class_name="Invoice", data_object={
                "is_deleted": False,
            }
        )
    return True

def get_trash_invoices(user_id: int = 0):
    where_operands = [
        {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id},
        {"path": ["is_deleted"], "operator": "Equal", "valueBoolean": True}
    ]
    query = client.query.get("Invoice", ["invoice_id", "store_name", "date", "total_amount", "deleted_at", "image_path", "_additional { id }"])
    query = query.with_where({"operator": "And", "operands": where_operands})
    
    try:
        result = query.with_limit(100).do()
        invoices = result.get("data", {}).get("Get", {}).get("Invoice", [])
        
        valid_invoices = []
        now = datetime.now(timezone.utc)
        
        for inv in invoices:
            if "invoice_id" in inv:
                inv["id"] = inv["invoice_id"]
                
            # Check 30 days
            del_at = inv.get("deleted_at")
            should_hard_delete = False
            if del_at:
                try:
                    # Parse ISO format, handles Z at the end
                    del_date = datetime.fromisoformat(del_at.replace('Z', '+00:00'))
                    days_passed = (now - del_date).days
                    if days_passed >= 30:
                        should_hard_delete = True
                except:
                    pass
            
            if should_hard_delete:
                delete_invoice_completely(inv["invoice_id"], user_id)
            else:
                valid_invoices.append(inv)
                
        return valid_invoices
    except Exception as e:
        print("[*] Log message removed due to unicode")
        return []



def delete_all_invoices_for_user(user_id: int) -> int:
    """
    Cascade Delete: Xóa toàn bộ hóa đơn và item liên kết của một user trong Weaviate.
    Được gọi tự động khi tài khoản user bị xóa.
    """
    deleted_count = 0
    try:
        # 1. Tìm tất cả hóa đơn thuộc user_id
        inv_result = client.query.get("Invoice", ["invoice_id", "_additional { id }"]).with_where(
            {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id}
        ).with_limit(10000).do()
        
        invoices = inv_result.get("data", {}).get("Get", {}).get("Invoice", [])
        print(f"[*] Đang thực hiện Cascade Delete: Tìm thấy {len(invoices)} hóa đơn của user_id={user_id}")
        
        for inv in invoices:
            uid = inv["_additional"]["id"]
            inv_id = inv.get("invoice_id")
            
            # Xóa các InvoiceItem con tương ứng
            if inv_id:
                try:
                    item_result = client.query.get("InvoiceItem", ["_additional { id }"]).with_where(
                        {"path": ["invoice_id_ref"], "operator": "Equal", "valueString": inv_id}
                    ).with_limit(1000).do()
                    for itm in item_result.get("data", {}).get("Get", {}).get("InvoiceItem", []):
                        client.data_object.delete(itm["_additional"]["id"], class_name="InvoiceItem")
                except Exception as e:
                    print(f"[!] Lỗi xóa InvoiceItem theo invoice_id_ref={inv_id}: {e}")
                    
            # Xóa Invoice cha
            client.data_object.delete(uid, class_name="Invoice")
            deleted_count += 1
            
        # 2. Xóa các InvoiceItem mồ côi nếu có user_id tương ứng
        try:
            item_by_uid = client.query.get("InvoiceItem", ["_additional { id }"]).with_where(
                {"path": ["user_id"], "operator": "Equal", "valueNumber": user_id}
            ).with_limit(10000).do()
            for itm in item_by_uid.get("data", {}).get("Get", {}).get("InvoiceItem", []):
                client.data_object.delete(itm["_additional"]["id"], class_name="InvoiceItem")
        except Exception:
            pass
            
        print(f"[✓] Cascade Delete hoàn tất: Đã xóa {deleted_count} hóa đơn của user_id={user_id}")
    except Exception as e:
        print(f"[!] Lỗi khi xóa toàn bộ hóa đơn của user {user_id}: {e}")
        
    return deleted_count

def empty_trash_invoices(user_id: int = 0) -> int:
    """Xóa vĩnh viễn toàn bộ hóa đơn trong thùng rác của user"""
    trash = get_trash_invoices(user_id=user_id)
    count = 0
    for inv in trash:
        inv_id = inv.get("invoice_id")
        if inv_id:
            delete_invoice_completely(inv_id, user_id=user_id)
            count += 1
    return count

def batch_delete_invoices_completely(invoice_ids: list, user_id: int = 0) -> int:
    """Xóa vĩnh viễn danh sách hóa đơn được chọn"""
    count = 0
    for inv_id in invoice_ids:
        if inv_id:
            delete_invoice_completely(inv_id, user_id=user_id)
            count += 1
    return count

def batch_restore_invoices(invoice_ids: list, user_id: int = 0) -> int:
    """Khôi phục danh sách hóa đơn được chọn"""
    count = 0
    for inv_id in invoice_ids:
        if inv_id:
            if restore_invoice(inv_id, user_id=user_id):
                count += 1
    return count
