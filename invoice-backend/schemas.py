from pydantic import BaseModel
from typing import List, Optional

class InvoiceItem(BaseModel):
    item_name: str
    quantity: int
    unit_price: float
    total_price: float

class InvoiceData(BaseModel):
    invoice_id: str
    ocr_confidence: float
    store_name: str
    store_address: Optional[str] = None
    date: str
    total_amount: float
    tax_amount: float
    items: List[InvoiceItem]
    raw_text: str
    image_path: Optional[str] = None
    is_submitted: Optional[bool] = False

class QA_Request(BaseModel):
    invoice_id: Optional[str] = None
    question: str

class Global_QA_Request(BaseModel):
    question: str

class QA_Data(BaseModel):
    answer: str

class QA_Response(BaseModel):
    status: int
    message: str
    data: Optional[QA_Data] = None

class BatchInvoiceResponse(BaseModel):
    status: int
    message: str
    data: List[InvoiceData]
    errors: List[str]

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

# --- OTP Schemas ---
class OtpRequest(BaseModel):
    """Nhận email hoặc số điện thoại để gửi mã OTP"""
    contact: str
    username: Optional[str] = None

class UserRegisterWithOtp(BaseModel):
    """Schema đăng ký tích hợp OTP – bắt buộc xác thực trước khi tạo tài khoản"""
    username: str
    full_name: str
    email: str
    password: str
    otp_code: Optional[str] = None

class ChangePassword(BaseModel):
    old_password: str
    new_password: str

class UserProfileUpdate(BaseModel):
    email: str

class ToggleLockRequest(BaseModel):
    user_id: int
    lock_status: bool

class ReportCreate(BaseModel):
    description: str
    invoice_id: Optional[str] = None
