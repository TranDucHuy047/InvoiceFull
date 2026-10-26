import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

def send_otp_email(to_email: str, otp_code: str):
    sender_email = os.getenv("SMTP_EMAIL", "")
    sender_password = os.getenv("SMTP_PASSWORD", "")
    
    if not sender_email or not sender_password:
        print(f"[CẢNH BÁO] Chưa cấu hình SMTP_EMAIL và SMTP_PASSWORD. OTP = {otp_code}")
        return False
        
    try:
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = to_email
        msg['Subject'] = "Mã xác nhận OTP - Invoice QA App"
        
        body = f"Chào bạn,\n\nMã xác nhận OTP của bạn là: {otp_code}\n\nMã này có hiệu lực trong 5 phút.\nVui lòng không chia sẻ mã này cho bất kỳ ai.\n\nTrân trọng,\nInvoice QA Team"
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"[LỖI SMTP] Không thể gửi email: {e}")
        return False
