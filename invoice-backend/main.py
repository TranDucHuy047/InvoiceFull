from fastapi.staticfiles import StaticFiles
import os
from fastapi import FastAPI
from database import setup_database
from routers import auth_router, invoice_router, qa_router, report_router, backup_router

# 1. Khá»Ÿi táº¡o cáº¥u trĂºc Database (Weaviate Schema sáº½ Ä‘Æ°á»£c táº¡o á»Ÿ Ä‘Ă¢y)
# (LÆ°u Ă½: SQLite Ä‘Ă£ Ä‘Æ°á»£c tá»± Ä‘á»™ng khá»Ÿi táº¡o khi import file auth.py)
setup_database()

from fastapi.middleware.cors import CORSMiddleware

# 2. Khá»Ÿi táº¡o á»©ng dá»¥ng FastAPI chĂ­nh
app = FastAPI(
    title="Invoice Analysis API", 
    version="1.0",
    description="Há»‡ thá»‘ng Backend xá»­ lĂ½ HĂ³a Ä‘Æ¡n tĂ­ch há»£p AI & Vector Search"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Gáº¯n (Include) cĂ¡c module API Ä‘Ă£ bĂ³c tĂ¡ch vĂ o App chĂ­nh
app.include_router(auth_router.router)
app.include_router(invoice_router.router)
app.include_router(qa_router.router)
app.include_router(report_router.router)
app.include_router(backup_router.router)

# 4. Äiá»ƒm neo kiá»ƒm tra tráº¡ng thĂ¡i mĂ¡y chá»§ (Health Check)
@app.get("/", tags=["Tráº¡ng thĂ¡i Server"])
async def root():
    return {"status": 200, "message": "Server FastAPI Backend Ä‘ang hoáº¡t Ä‘á»™ng trÆ¡n tru!"}

# Mount uploads directory
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

