from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
import sqlite3
from email_service import send_otp_email
import random
import time
from typing import Optional

# Import các hàm bảo mật từ file auth.py
from auth import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    create_user, 
    get_user, 
    get_current_user, 
    get_current_admin,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

# Import các định dạng dữ liệu từ file schemas.py
from schemas import (
    UserRegisterWithOtp,
    OtpRequest,
    ChangePassword, 
    UserProfileUpdate
)

# Import client Weaviate và DB chat từ database.py để dùng cho API thống kê
from database import delete_all_invoices_for_user, client, chat_history_db

# Khởi tạo Router
router = APIRouter()

# ==========================================
# --- OTP STORAGE (IN-MEMORY) ---
# Lưu OTP tạm thời: { "email_or_phone": {"code": "123456", "expires_at": timestamp} }
# ==========================================
_otp_store: dict = {}
OTP_TTL_SECONDS = 300  # 5 phút


def _generate_otp() -> str:
    """Sinh mã OTP 6 chữ số ngẫu nhiên"""
    return f"{random.randint(100000, 999999)}"


def _save_otp(contact: str, code: str):
    """Lưu OTP vào in-memory store với TTL 5 phút"""
    _otp_store[contact.lower().strip()] = {
        "code": code,
        "expires_at": time.time() + OTP_TTL_SECONDS
    }


def _verify_otp(contact: str, code: str) -> bool:
    """Kiểm tra OTP hợp lệ và chưa hết hạn. Xóa OTP sau khi xác thực thành công."""
    entry = _otp_store.get(contact.lower().strip())
    if not entry:
        return False
    if time.time() > entry["expires_at"]:
        _otp_store.pop(contact.lower().strip(), None)
        return False
    if entry["code"] != code.strip():
        return False
    # Xóa OTP sau khi dùng (One-Time Password)
    _otp_store.pop(contact.lower().strip(), None)
    return True


# ==========================================
# --- API XÁC THỰC & TÀI KHOẢN (AUTH) ---
# ==========================================

@router.post("/api/auth/send-otp", tags=["Auth"], summary="Gửi mã OTP 6 số qua Email/SĐT")
async def send_otp(request: OtpRequest):
    """
    Sinh mã OTP 6 chữ số và lưu vào bộ nhớ tạm (TTL 5 phút).
    Kiểm tra xem email/username đã tồn tại trong DB chưa trước khi gửi.
    """
    contact = request.contact.lower().strip()
    username = request.username.strip() if request.username else ""
    if not contact:
        raise HTTPException(status_code=400, detail="Email không được để trống.")
        
    # KIỂM TRA TRÙNG LẶP TRƯỚC KHI GỬI OTP
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    if username:
        cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, contact))
    else:
        cursor.execute("SELECT id FROM users WHERE email = ?", (contact,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Tên đăng nhập hoặc email đã tồn tại!")
    conn.close()
    
    otp_code = _generate_otp()
    _save_otp(contact, otp_code)
    
    # Gửi qua Email thực tế
    email_sent = send_otp_email(contact, otp_code)
    if not email_sent:
        print(f"[OTP FALLBACK] Mã OTP cho '{contact}': {otp_code}")
    
    msg = f"Đã gửi mã OTP đến {contact}. Mã có hiệu lực trong 5 phút."
    if not email_sent:
        msg += f" (Mã xác thực: {otp_code})"
        
    return {
        "status": 200,
        "message": msg,
        "otp_code": otp_code if not email_sent else None
    }


@router.post("/api/auth/register", tags=["Auth"], summary="Đăng ký tài khoản mới (có xác thực OTP)")
async def register(user: UserRegisterWithOtp):
    """
    Đăng ký tài khoản mới sau khi xác thực OTP.
    Luồng: Gọi /api/auth/send-otp -> Nhận OTP -> Gọi API này với otp_code.
    """
    if not user.otp_code or not user.otp_code.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập mã OTP đã được gửi đến email của bạn!")

    # 1. Kiểm tra OTP
    if not _verify_otp(user.email, user.otp_code.strip()):
        raise HTTPException(
            status_code=400,
            detail="Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng lấy mã mới."
        )
    
    # 2. Tạo user sau khi OTP hợp lệ
    hashed_pw = get_password_hash(user.password)
    success = create_user(user.username, user.email, hashed_pw, full_name=user.full_name)
    if not success:
        raise HTTPException(status_code=400, detail="Tên đăng nhập hoặc email đã tồn tại!")
    
    return {"status": 200, "message": "Đăng ký thành công! Bạn có thể đăng nhập ngay bây giờ."}


@router.post("/api/auth/login", tags=["Auth"], summary="Đăng nhập bằng Username + Password → Nhận JWT Token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Đăng nhập bằng username và password (OAuth2 Password Flow).
    Frontend gửi: username, password dạng form-data (application/x-www-form-urlencoded).
    """
    user = get_user(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sai tên đăng nhập hoặc mật khẩu",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "user_id": user["id"], 
        "role": user["role"],
        "user": {"id": user["id"], "username": user["username"], "role": user["role"], "full_name": user.get("full_name", ""), "email": user.get("email", ""), "created_at": user.get("created_at", "")}
    }


@router.post("/api/auth/change-password", tags=["Auth"], summary="Đổi mật khẩu")
@router.put("/api/auth/change-password", tags=["Auth"], summary="Đổi mật khẩu")
async def change_password(request: ChangePassword, current_user: dict = Depends(get_current_user)):
    if not verify_password(request.old_password, current_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không chính xác!")
    
    new_hashed_pw = get_password_hash(request.new_password)
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET hashed_password = ? WHERE username = ?", (new_hashed_pw, current_user["username"]))
    conn.commit()
    conn.close()
    
    return {"status": 200, "message": "Đổi mật khẩu thành công!"}


@router.put("/api/auth/profile", tags=["Auth"], summary="Cập nhật thông tin cá nhân")
async def update_profile(request: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    try:
        conn = sqlite3.connect("users.db")
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM users WHERE email = ? AND id != ?", (request.email, current_user["id"]))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Email này đã được sử dụng bởi tài khoản khác.")
            
        cursor.execute("UPDATE users SET email = ? WHERE id = ?", (request.email, current_user["id"]))
        conn.commit()
        conn.close()
        
        return {"status": 200, "message": "Cập nhật thông tin cá nhân thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/auth/me", tags=["Auth"], summary="Lấy thông tin tài khoản đang đăng nhập")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    return {
        "status": 200, 
        "data": {
            "id": current_user["id"], 
            "username": current_user["username"], 
            "full_name": current_user.get("full_name", ""),
            "email": current_user["email"], 
            "role": current_user["role"],
            "created_at": current_user.get("created_at", "")
        }
    }


@router.post("/api/auth/logout", tags=["Auth"], summary="Đăng xuất tài khoản")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"status": 200, "message": "Đăng xuất thành công. Yêu cầu client xóa token."}


# ==========================================
# --- QUẢN TRỊ VIÊN (ADMIN) ---
# ==========================================

@router.get("/api/admin/users", tags=["Admin"], summary="Lấy danh sách tất cả tài khoản (Có tìm kiếm)")
async def get_all_users(search: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    """Hỗ trợ lọc theo username hoặc email qua query param 'search'"""
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    
    if search:
        search_term = f"%{search}%"
        cursor.execute(
            "SELECT id, username, email, role, is_locked, full_name, created_at FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY id DESC", 
            (search_term, search_term)
        )
    else:
        cursor.execute("SELECT id, username, email, role, is_locked, full_name, created_at FROM users ORDER BY id DESC")
        
    rows = cursor.fetchall()
    conn.close()
    
    users = [
        {"id": r[0], "username": r[1], "email": r[2], "role": r[3], "is_locked": bool(r[4]), "full_name": r[5], "created_at": r[6] if len(r) > 6 and r[6] else ""}
        for r in rows
    ]
    return {"status": 200, "message": "Thành công", "data": users}


@router.put("/api/admin/users/{user_id}/toggle-lock", tags=["Admin"], summary="Khóa hoặc mở khóa tài khoản user")
async def toggle_lock_user(
    user_id: int, 
    lock_status: Optional[bool] = None, 
    body: Optional[dict] = Body(None),
    admin: dict = Depends(get_current_admin)
):
    """Hỗ trợ nhận lock_status qua query param (?lock_status=true) hoặc JSON body ({is_locked: true})"""
    if lock_status is None and body is not None:
        lock_status = body.get("lock_status", body.get("is_locked", None))
        
    if lock_status is None:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp trạng thái khóa (lock_status hoặc is_locked).")

    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Không thể tự khóa tài khoản Admin của chính mình.")
        
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_locked = ? WHERE id = ?", (int(lock_status), user_id))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng này trong hệ thống.")
        
    conn.commit()
    conn.close()
    
    action = "Khóa" if lock_status else "Mở khóa"
    return {"status": 200, "message": f"{action} tài khoản thành công!", "is_locked": bool(lock_status)}


@router.put("/api/admin/users/{user_id}/role", tags=["Admin"], summary="Thay đổi quyền (Role) của người dùng")
async def change_user_role(user_id: int, new_role: str, admin: dict = Depends(get_current_admin)):
    """new_role: 'admin' hoặc 'user'"""
    if new_role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Quyền không hợp lệ (chỉ 'admin' hoặc 'user').")
        
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Không thể tự đổi quyền của chính mình.")
        
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, user_id))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng này trong hệ thống.")
        
    conn.commit()
    conn.close()
    
    return {"status": 200, "message": f"Thay đổi quyền thành {new_role} thành công!"}


@router.delete("/api/admin/users/{user_id}", tags=["Admin"], summary="Xóa vĩnh viễn tài khoản người dùng")
async def delete_user(user_id: int, admin: dict = Depends(get_current_admin)):
    """Xóa vĩnh viễn tài khoản người dùng khỏi hệ thống và cascade xóa toàn bộ hóa đơn/chat liên quan"""
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Không thể tự xóa tài khoản Admin của chính mình.")
        
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, username, role FROM users WHERE id = ?", (user_id,))
    target = cursor.fetchone()
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng này trong hệ thống.")
    
    username = target[1]
    
    # 1. CASCADE DELETE: Xóa toàn bộ hóa đơn và mục hàng (Invoice + InvoiceItem) trong Weaviate
    deleted_invoices_count = 0
    try:
        deleted_invoices_count = delete_all_invoices_for_user(user_id)
        print(f"[*] Cascade Delete: Đã xóa {deleted_invoices_count} hóa đơn của '{username}' (ID={user_id})")
    except Exception as e:
        print(f"[!] Lỗi khi cascade delete hóa đơn của user {user_id}: {e}")

    # 2. Xóa lịch sử chat của user trong chat_history.json
    try:
        str_uid = str(user_id)
        if str_uid in chat_history_db:
            del chat_history_db[str_uid]
        if os.path.exists("chat_history.json"):
            with open("chat_history.json", "r", encoding="utf-8") as f:
                chats = json.load(f)
            if str_uid in chats:
                del chats[str_uid]
                with open("chat_history.json", "w", encoding="utf-8") as f:
                    json.dump(chats, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[!] Lỗi xóa lịch sử chat của user {user_id}: {e}")

    # 3. Xóa các báo cáo sự cố (reports) của user
    try:
        cursor.execute("DELETE FROM reports WHERE user_id = ?", (user_id,))
    except Exception:
        pass

    # 4. Xóa tài khoản trong bảng users
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    
    return {
        "status": 200, 
        "message": f"Đã xóa vĩnh viễn tài khoản '{username}' và toàn bộ {deleted_invoices_count} hóa đơn liên quan thành công!"
    }

@router.get("/api/admin/invoices", tags=["Admin"], summary="Lấy danh sách tất cả hóa đơn toàn hệ thống")
async def get_all_system_invoices(admin: dict = Depends(get_current_admin)):
    """API cho màn hình Quản lý Hóa đơn của Admin (chỉ xem metadata)"""
    from database import delete_all_invoices_for_user, client
    try:
        query = client.query.get("Invoice", ["invoice_id", "store_name", "date", "total_amount", "user_id"])
        query = query.with_where({"path": ["is_deleted"], "operator": "NotEqual", "valueBoolean": True})
        query = query.with_limit(1000).do()
        
        invoices = []
        if "data" in query and "Get" in query["data"] and "Invoice" in query["data"]["Get"]:
            invoices = query["data"]["Get"]["Invoice"]
            
        # Lấy thêm tên user để hiển thị
        conn = sqlite3.connect("users.db")
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email FROM users")
        users_dict = {row[0]: row[1] for row in cursor.fetchall()}
        conn.close()
        
        for inv in invoices:
            uid = inv.get("user_id")
            if uid is not None and uid in users_dict:
                inv["user_name"] = users_dict[uid]
            elif uid is not None and uid != 0:
                inv["user_name"] = f"User #{uid}"
            else:
                inv["user_name"] = "Khách vãng lai" 
            
        return {"status": 200, "message": "Thành công", "data": invoices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/admin/statistics", tags=["Admin"], summary="Lấy số liệu thống kê tổng quan")
async def get_admin_statistics(admin: dict = Depends(get_current_admin)):
    # 1. Đếm tổng số User
    conn = sqlite3.connect("users.db", isolation_level="DEFERRED")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]
    
    # Count reports
    total_reports = 0
    try:
        cursor.execute("SELECT COUNT(*) FROM reports")
        total_reports = cursor.fetchone()[0]
    except Exception:
        pass
        
    conn.commit()
    conn.close()
    
    # 2. Đếm tổng số Hóa đơn
    total_invoices = 0
    try:
        agg_result = client.query.aggregate("Invoice").with_meta_count().do()
        if "data" in agg_result and "Aggregate" in agg_result["data"]:
            total_invoices = agg_result["data"]["Aggregate"]["Invoice"][0]["meta"]["count"]
    except Exception as e:
        print(f"[!] Lỗi đếm hóa đơn Weaviate: {e}")
        
    # 3. Đếm tổng số lượt Chat
    total_chats = 0
    for user_id, user_chats in chat_history_db.items():
        for inv_id, messages in user_chats.items():
            total_chats += (len(messages) // 2)
            
    return {
        "status": 200, 
        "message": "Thành công", 
        "data": {
            "total_users": total_users,
            "total_invoices": total_invoices,
            "total_chat_queries": total_chats
        }
    }
