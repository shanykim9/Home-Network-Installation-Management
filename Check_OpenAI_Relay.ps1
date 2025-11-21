# Check_OpenAI_Relay.ps1
# OpenAI API / Relay 접속 가능 여부를 검사하는 간단한 스크립트

$targets = @(
    @{ Name = "OpenAI API (api.openai.com)"; Host = "api.openai.com"; Port = 443 },
    @{ Name = "OpenAI Relay (oai.relay.openai.com)"; Host = "oai.relay.openai.com"; Port = 443 }
)

Write-Host "===== OpenAI 연결 검사 시작 =====`n"

foreach ($t in $targets) {
    Write-Host ""
    Write-Host "▶ " $t.Name " 검사 중..." -ForegroundColor Cyan
    try {
        # 네트워크 연결 테스트 (Ping + TCP 443 포트)
        $result = Test-NetConnection -ComputerName $t.Host -Port $t.Port -WarningAction SilentlyContinue -ErrorAction Stop

        if ($result.TcpTestSucceeded) {
            Write-Host "  ✅ TCP 443 포트 연결 성공" -ForegroundColor Green
        } else {
            Write-Host "  ❌ TCP 443 포트 연결 실패" -ForegroundColor Red
        }

        if ($result.PingSucceeded) {
            Write-Host "  ✅ Ping 응답 있음"
        } else {
            Write-Host "  ⚠ Ping 응답 없음 (방화벽에서 Ping만 막을 수도 있음)"
        }

        Write-Host "  - 원격 주소: $($result.RemoteAddress)"
    }
    catch {
        Write-Host "  ❌ 테스트 중 오류 발생 (DNS 또는 방화벽 차단 가능성 높음)" -ForegroundColor Red
        Write-Host "  - 오류 메시지: $($_.Exception.Message)"
    }
}

Write-Host "`n===== 검사 완료 ====="
Write-Host "※ OpenAI API는 ✅인데 Relay가 ❌이면, 회사망이 Relay(oai.relay.openai.com)를 차단한 것입니다."
