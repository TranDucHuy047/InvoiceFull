# Dùng bản Python 3.9 gọn nhẹ
FROM python:3.9-slim

WORKDIR /app

# Chỉ cài thư viện gomp (thường được PaddleOCR yêu cầu để chạy đa luồng)
RUN apt-get update && apt-get install -y \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và cài đặt thư viện Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn vào container
COPY . .

# Mở cổng 8000 ra ngoài
EXPOSE 8000

# Khởi chạy server FastAPI, bind vào 0.0.0.0 để mạng LAN có thể truy cập
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]