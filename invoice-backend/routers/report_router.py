from fastapi import APIRouter, Depends, HTTPException, status
import sqlite3
from typing import Optional
from pydantic import BaseModel
from auth import get_current_user, get_current_admin
from schemas import ReportCreate

router = APIRouter()

class ReportStatusUpdate(BaseModel):
    status: str  # 'new', 'processing', 'resolved'

def init_report_db():
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            invoice_id TEXT,
            status TEXT DEFAULT 'new',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    try:
        cursor.execute("ALTER TABLE reports ADD COLUMN invoice_id TEXT")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE reports ADD COLUMN status TEXT DEFAULT 'new'")
    except Exception:
        pass
    conn.commit()
    conn.close()
    print("[*] SQLite database initialized for Reports.")

init_report_db()

@router.post("/api/reports", tags=["Reports"], summary="Gửi báo cáo lỗi")
@router.post("/reports", tags=["Reports"], summary="Gửi báo cáo lỗi (alias)")
async def create_report(report: ReportCreate, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    inv_id = getattr(report, "invoice_id", None)
    cursor.execute("INSERT INTO reports (user_id, description, invoice_id, status) VALUES (?, ?, ?, 'new')", 
                   (current_user["id"], report.description, inv_id))
    conn.commit()
    conn.close()
    return {"status": 200, "message": "Báo cáo của bạn đã được gửi thành công!"}

@router.get("/api/admin/reports", tags=["Admin"], summary="Lấy danh sách báo cáo lỗi")
@router.get("/admin/reports", tags=["Admin"], summary="Lấy danh sách báo cáo lỗi (alias)")
async def get_reports(admin: dict = Depends(get_current_admin)):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute('''
        SELECT r.id, r.description, r.created_at, u.username, u.email, u.full_name, r.invoice_id, r.status
        FROM reports r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.id DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    reports = [
        {
            "id": r[0],
            "description": r[1],
            "created_at": r[2],
            "username": r[3],
            "email": r[4],
            "full_name": r[5],
            "invoice_id": r[6] if (len(r) > 6 and r[6]) else "Hệ thống",
            "status": r[7] if (len(r) > 7 and r[7]) else "new"
        }
        for r in rows
    ]
    return {"status": 200, "data": reports}

@router.put("/api/admin/reports/{report_id}/status", tags=["Admin"], summary="Cập nhật trạng thái báo cáo lỗi")
@router.put("/admin/reports/{report_id}/status", tags=["Admin"], summary="Cập nhật trạng thái báo cáo lỗi (alias)")
async def update_report_status(report_id: int, payload: ReportStatusUpdate, admin: dict = Depends(get_current_admin)):
    if payload.status not in ["new", "processing", "resolved"]:
        raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ. Chỉ chấp nhận: new, processing, resolved")
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("UPDATE reports SET status = ? WHERE id = ?", (payload.status, report_id))
    conn.commit()
    conn.close()
    return {"status": 200, "message": "Cập nhật trạng thái thành công!"}
