#!/usr/bin/env bash
# 一鍵環境安裝（跨平台：Linux / macOS / Windows Git Bash）
# Usage: bash scripts/setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# ── 偵測 Python 執行檔 ────────────────────────────────
# Windows 常用 python 或 py -3，Linux/macOS 用 python3
detect_python() {
    if command -v python3 >/dev/null 2>&1; then
        echo "python3"
    elif command -v python >/dev/null 2>&1; then
        # 確認是 Python 3.10+
        if python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" 2>/dev/null; then
            echo "python"
        else
            echo ""
        fi
    else
        echo ""
    fi
}

PYTHON="$(detect_python)"
if [ -z "$PYTHON" ]; then
    echo "❌ 找不到 Python 3.10+。請先安裝："
    echo "   Windows: https://www.python.org/downloads/  安裝時勾選「Add Python to PATH」"
    echo "   macOS:   brew install python@3.11"
    echo "   Linux:   sudo apt install python3 python3-venv"
    exit 1
fi
echo "▶ 使用 Python: $($PYTHON --version)"

# ── 建立 venv ─────────────────────────────────────────
if [ ! -d ".venv" ]; then
    echo "▶ 建立 Python 虛擬環境 (.venv)"
    "$PYTHON" -m venv .venv
fi

# ── 偵測 venv activate 路徑（跨平台）─────────────────
# Linux/macOS: .venv/bin/activate
# Windows:     .venv/Scripts/activate
if [ -f ".venv/bin/activate" ]; then
    VENV_ACTIVATE=".venv/bin/activate"
    VENV_BIN=".venv/bin"
elif [ -f ".venv/Scripts/activate" ]; then
    VENV_ACTIVATE=".venv/Scripts/activate"
    VENV_BIN=".venv/Scripts"
else
    echo "❌ 找不到 venv 啟動腳本；venv 建立失敗？"
    exit 1
fi

# shellcheck disable=SC1090
source "$VENV_ACTIVATE"
echo "▶ 已啟用 venv：$VENV_ACTIVATE"

# ── 升級 pip + 安裝依賴 ───────────────────────────────
echo "▶ 升級 pip"
python -m pip install --upgrade pip -q

echo "▶ 安裝相依套件（可能需 1~2 分鐘）"
python -m pip install -r requirements.txt -q

# ── Playwright 瀏覽器（可選）──────────────────────────
if [ "${SKIP_PLAYWRIGHT_BROWSERS:-}" = "1" ]; then
    echo "▶ 跳過 Playwright 瀏覽器下載（SKIP_PLAYWRIGHT_BROWSERS=1）"
else
    echo "▶ 安裝 Playwright chromium 瀏覽器（約 200MB，可能需 2~5 分鐘）"
    echo "   （若只跑 unit，可用 SKIP_PLAYWRIGHT_BROWSERS=1 bash scripts/setup.sh 跳過）"
    python -m playwright install chromium
fi

# ── 驗證 ─────────────────────────────────────────────
echo ""
echo "▶ 驗證安裝"
python -c "import pytest, hypothesis, requests, jsonschema; print('  ✅ 核心套件 OK')"

echo ""
echo "✅ 環境準備完成。"
echo ""
echo "   下一步："
if [ "$VENV_BIN" = ".venv/Scripts" ]; then
    echo "   Windows Git Bash: source .venv/Scripts/activate"
else
    echo "   啟用：source .venv/bin/activate"
fi
echo "   跑單元測試（應該 48 綠）：pytest tests/unit -v"
echo "   跑全套：bash scripts/run-all.sh"
