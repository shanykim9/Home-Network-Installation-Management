import qrcode

# Flask 앱 URL (새로운 IP 주소)
app_url = "http://10.72.198.167:5000"

# QR 코드 생성
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=10,
    border=4,
)

# URL 추가
qr.add_data(app_url)
qr.make(fit=True)

# QR 코드 이미지 생성
qr_image = qr.make_image(fill_color="black", back_color="white")

# 파일로 저장
filename = "flask_app_qr_code.png"
qr_image.save(filename)

print(f"✅ QR 코드가 '{filename}' 파일로 생성되었습니다!")
print(f"📱 URL: {app_url}")
print(f"🔍 QR 코드를 스캔하여 모바일에서 앱을 테스트하세요!")
print(f"📱 스와이프 기능 테스트: 현장등록 탭에서 좌우 스와이프로 탭 전환")
