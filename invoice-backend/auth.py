import os
import sqlite3
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

# --- CẤU HÌNH BẢO MẬT JWT ---
SECRET_KEY = "khoa-luan-tot-nghiep-ai-invoice-secret-key"  # Trong thực tế nên để vào file .env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # Token có hạn 1 ngày

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# --- HÀM TIỆN ÍCH (SỬ DỤNG BCRYPT TRỰC TIẾP) ---
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        raw = plain_password.encode('utf-8')
        hpw = hashed_password.encode('utf-8')
        if bcrypt.checkpw(raw, hpw):
            return True
        # Check trimmed
        trimmed = plain_password.strip().encode('utf-8')
        if bcrypt.checkpw(trimmed, hpw):
            return True
        # Check capitalized (VD: huy123 -> Huy123)
        if bcrypt.checkpw(plain_password.capitalize().encode('utf-8'), hpw):
            return True
        if bcrypt.checkpw(plain_password.strip().capitalize().encode('utf-8'), hpw):
            return True
        # Check lowercase
        if bcrypt.checkpw(plain_password.lower().encode('utf-8'), hpw):
            return True
        if bcrypt.checkpw(plain_password.strip().lower().encode('utf-8'), hpw):
            return True
        return False
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- CƠ SỞ DỮ LIỆU SQLITE CHO USER ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "users.db")

def init_user_db():
    """Khởi tạo bảng Users trong SQLite và tự động nâng cấp schema thêm cột is_locked và full_name"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )
    ''')
    
    # Tự động cập nhật DB cũ: Thêm cột is_locked nếu chưa có
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN is_locked INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass # Bỏ qua nếu cột đã tồn tại
        
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass # Bỏ qua nếu cột đã tồn tại
        
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass # Bỏ qua nếu cột đã tồn tại
        
    conn.commit()
    conn.close()
    print("[*] SQLite database initialized for Users.")

def get_user(username: str):
    """Lấy thông tin user từ DB (bao gồm trạng thái khóa và full_name)"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, hashed_password, role, is_locked, full_name, created_at FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0], 
            "username": row[1], 
            "email": row[2], 
            "hashed_password": row[3], 
            "role": row[4], 
            "is_locked": bool(row[5]),
            "full_name": row[6],
            "created_at": row[7] if len(row) > 7 and row[7] else ""
        }
    return None

def create_user(username: str, email: str, hashed_password: str, role: str = "user", full_name: str = "", created_at: str = None):
    """Tạo user mới kèm ngày tạo"""
    try:
        if not created_at:
            created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        # Mặc định user mới tạo ra sẽ không bị khóa (is_locked = 0)
        cursor.execute("INSERT INTO users (username, email, hashed_password, role, is_locked, full_name, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
                       (username, email, hashed_password, role, full_name, created_at))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False # Trùng username hoặc email

# Khởi tạo bảng ngay khi chạy file
init_user_db()

# --- XÁC THỰC TOKEN TỪ REQUEST ---
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin tài khoản (Token không hợp lệ)",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = get_user(username=username)
    if user is None:
        raise credentials_exception
        
    # Chặn đứng nếu tài khoản đã bị Admin khóa
    if user.get("is_locked"):
        raise HTTPException(status_code=403, detail="Tài khoản của bạn đã bị khóa bởi quản trị viên.")
        
    return user

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    """Middleware phân quyền: Chỉ cho phép Admin đi qua"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Không có quyền truy cập. Phân hệ này chỉ dành cho Admin.")
    return current_user
