# -*- coding: utf-8 -*-
import os
import subprocess
import time

def main():
    print("Starting ADB Logcat Listener for Admin Login...")
    adb_path = r"C:\Users\ADMIN\AppData\Local\Android\Sdk\platform-tools\adb.exe"
    
    if not os.path.exists(adb_path):
        print(f"ADB not found at {adb_path}")
        return

    subprocess.run([adb_path, 'logcat', '-c'])
    process = subprocess.Popen([adb_path, 'logcat'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace')
    
    last_open_time = 0

    while True:
        line = process.stdout.readline()
        if not line:
            time.sleep(0.1)
            continue
            
        if 'OPEN_HOST_BROWSER_ADMIN' in line:
            now = time.time()
            if now - last_open_time < 5.0:
                continue  # Bỏ qua các tín hiệu trùng lặp trong vòng 5 giây
            last_open_time = now

            token = ""
            if 'OPEN_HOST_BROWSER_ADMIN:' in line:
                token = line.split('OPEN_HOST_BROWSER_ADMIN:')[1].strip()
            
            print("Detected Admin Login from Emulator. Opening exactly 1 browser tab on host Windows...", flush=True)
            
            url = f"http://localhost:5173/login?token={token}" if token else "http://localhost:5173"
            
            # Chỉ mở đúng 1 lần qua ScheduledTask tương tác với Desktop của user (không dùng trigger hẹn giờ)
            ps_script = f"""
            $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c start "" "{url}"'
            Register-ScheduledTask -TaskName 'OpenAdminWeb' -Action $action -User $env:USERNAME -Force
            Start-ScheduledTask -TaskName 'OpenAdminWeb'
            """
            subprocess.run(["powershell", "-Command", ps_script])

if __name__ == "__main__":
    main()
