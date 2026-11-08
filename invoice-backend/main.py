from dotenv import load_dotenv
load_dotenv()
from fastapi.staticfiles import StaticFiles
import os
from fastapi import FastAPI
from database import setup_database
from routers import auth_router, invoice_router, qa_router, report_router, backup_router

# 1. Khởi tạo cấu trúc Database (Weaviate Schema sẽ được tạo ở đây)
# (Lưu ý: SQLite đã được tự động khởi tạo khi import file auth.py)
setup_database()

from fastapi.middleware.cors import CORSMiddleware

# 2. Khởi tạo ứng dụng FastAPI chính
app = FastAPI(
    title="Invoice Analysis API", 
    version="1.0",
    description="Hệ thống Backend xử lý Hóa đơn tích hợp AI & Vector Search"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Gắn (Include) các module API đã bóc tách vào App chính
app.include_router(auth_router.router)
app.include_router(invoice_router.router)
app.include_router(qa_router.router)
app.include_router(report_router.router)
app.include_router(backup_router.router)

# 4. Điểm neo kiểm tra trạng thái máy chủ (Health Check)
@app.get("/", tags=["Trạng thái Server"])
async def root():
    return {"status": 200, "message": "Server FastAPI Backend đang hoạt động trơn tru!"}

# Mount uploads directory
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
