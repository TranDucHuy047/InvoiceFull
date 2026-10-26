from fastapi import APIRouter, Depends, HTTPException, status
from auth import get_current_admin
import os
import glob
import zipfile
import shutil
from datetime import datetime

router = APIRouter()
BACKUP_DIR = "backups"

def ensure_backup_dir():
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)

@router.get("/api/admin/backups", tags=["Admin"], summary="Lấy danh sách các bản sao lưu")
@router.get("/admin/backups", tags=["Admin"], summary="Lấy danh sách các bản sao lưu (alias)")
async def get_backups(admin: dict = Depends(get_current_admin)):
    ensure_backup_dir()
    backups = []
    
    # List all .zip files in BACKUP_DIR
    files = glob.glob(os.path.join(BACKUP_DIR, "*.zip"))
    files.sort(key=os.path.getctime, reverse=True)
    
    for f in files:
        size = os.path.getsize(f)
        size_mb = round(size / (1024 * 1024), 2)
        if size_mb == 0:
            size_str = f"{round(size / 1024, 2)} KB"
        else:
            size_str = f"{size_mb} MB"
            
        c_time = os.path.getctime(f)
        dt = datetime.fromtimestamp(c_time).strftime('%d/%m/%Y %H:%M')
        
        backups.append({
            "name": os.path.basename(f),
            "size": size_str,
            "created_at": dt,
            "type": "Sao lưu"
        })
        
    return {"status": 200, "data": backups}

@router.post("/api/admin/backups", tags=["Admin"], summary="Tạo bản sao lưu mới")
@router.post("/admin/backups", tags=["Admin"], summary="Tạo bản sao lưu mới (alias)")
async def create_backup(admin: dict = Depends(get_current_admin)):
    ensure_backup_dir()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_filename = f"backup_{timestamp}.zip"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    
    files_to_backup = ["users.db", "chat_history.json"]
    
    try:
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file in files_to_backup:
                if os.path.exists(file):
                    zipf.write(file)
            if os.path.exists("uploads"):
                for root, _, upload_files in os.walk("uploads"):
                    for ufile in upload_files:
                        upath = os.path.join(root, ufile)
                        zipf.write(upath)
        return {"status": 200, "message": "Sao lưu dữ liệu thành công!"}
    except Exception as e:
        if os.path.exists(backup_path):
            os.remove(backup_path)
        raise HTTPException(status_code=500, detail=f"Lỗi khi sao lưu: {str(e)}")

@router.post("/api/admin/backups/restore", tags=["Admin"], summary="Khôi phục dữ liệu từ bản sao lưu")
@router.post("/admin/backups/restore", tags=["Admin"], summary="Khôi phục dữ liệu từ bản sao lưu (alias)")
async def restore_backup(filename: str, admin: dict = Depends(get_current_admin)):
    ensure_backup_dir()
    backup_path = os.path.join(BACKUP_DIR, filename)
    
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp sao lưu này.")
        
    try:
        temp_dir = "temp_restore"
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        os.makedirs(temp_dir)
        
        with zipfile.ZipFile(backup_path, 'r') as zipf:
            zipf.extractall(temp_dir)
            
        for item in os.listdir(temp_dir):
            src = os.path.join(temp_dir, item)
            dst = item
            if os.path.isdir(src):
                if os.path.exists(dst):
                    shutil.rmtree(dst)
                shutil.copytree(src, dst)
            else:
                if os.path.exists(dst):
                    os.remove(dst)
                shutil.copy2(src, dst)
            
        shutil.rmtree(temp_dir)
        
        return {"status": 200, "message": "Khôi phục dữ liệu thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi khôi phục: {str(e)}")
