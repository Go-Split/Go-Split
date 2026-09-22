"""
建立三角色 Playwright storage_state
執行方式：
  python -m tests.e2e.auth_setup --role host    # 開瀏覽器手動 Google 登入
  python -m tests.e2e.auth_setup --role co      # 用邀請碼加入
  python -m tests.e2e.auth_setup --role member  # 用邀請碼加入
"""
import argparse
import os
from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = os.getenv("GOSPLIT_UI_BASE", "http://localhost:8000")
STATE_DIR = Path(os.getenv("GOSPLIT_STATE_DIR", "/tmp/gosplit-states"))
STATE_DIR.mkdir(parents=True, exist_ok=True)


def setup(role: str, invite_code: str | None = None):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(BASE_URL)

        if role == "host":
            print("→ 請在瀏覽器手動點 Google 登入並完成 OAuth")
            print("→ 完成後回到本 terminal 按 Enter")
            input()

        elif role in ("co", "member"):
            assert invite_code, f"{role} 需要 --invite-code"
            page.get_by_test_id("input-invite-code").fill(invite_code)
            email = f"{role}@sdd-test.local"
            phone = "0900000000" if role == "co" else "0911111111"
            page.get_by_test_id("input-email").fill(email)
            page.get_by_test_id("input-phone").fill(phone)
            page.get_by_test_id("btn-join").click()
            page.wait_for_url("**/home**", timeout=15_000)

        state_path = STATE_DIR / f"{role}.json"
        ctx.storage_state(path=str(state_path))
        print(f"✓ 已寫入 {state_path}")
        browser.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--role", required=True,
                   choices=["host", "co", "member"])
    p.add_argument("--invite-code", default=None)
    args = p.parse_args()
    setup(args.role, args.invite_code)
