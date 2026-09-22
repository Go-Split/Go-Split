#!/usr/bin/env bash
# 一鍵跑全套測試（跨平台：Linux / macOS / Windows Git Bash）
# Usage: bash scripts/run-all.sh [unit|api|e2e|all]
set -euo pipefail

cd "$(dirname "$0")/.."

# ── 偵測 venv activate 路徑（跨平台）─────────────────
if [ -f ".venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    # shellcheck disable=SC1091
    source .venv/Scripts/activate
else
    echo "❌ 找不到 venv；請先跑 bash scripts/setup.sh"
    exit 1
fi

# 若存在 .env 就 export（讓 GOSPLIT_* 生效）
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

MODE="${1:-all}"
mkdir -p reports htmlcov

case "$MODE" in
    unit)
        echo "▶ 單元測試（引擎）"
        pytest tests/unit -v \
            --html=reports/unit.html --self-contained-html \
            --cov=tests.support.engine --cov-report=html --cov-report=term
        ;;
    api)
        echo "▶ API 契約測試"
        pytest tests/api -v \
            --html=reports/api.html --self-contained-html
        ;;
    e2e)
        echo "▶ E2E 測試（Playwright）"
        pytest tests/e2e -v \
            --html=reports/e2e.html --self-contained-html
        ;;
    all)
        echo "▶ 1/3 單元測試"
        pytest tests/unit -v \
            --html=reports/unit.html --self-contained-html \
            --cov=tests.support.engine --cov-report=html --cov-report=term
        echo ""
        echo "▶ 2/3 API 契約"
        pytest tests/api -v \
            --html=reports/api.html --self-contained-html || echo "⚠️ API 測試部分失敗（後端可能未啟動或部分端點未實作）"
        echo ""
        echo "▶ 3/3 E2E"
        pytest tests/e2e -v \
            --html=reports/e2e.html --self-contained-html || echo "⚠️ E2E 部分失敗（前端可能未啟動）"
        ;;
    *)
        echo "Usage: $0 [unit|api|e2e|all]"
        exit 1
        ;;
esac

echo ""
echo "✅ 完成。查看 reports/ 與 htmlcov/index.html"
