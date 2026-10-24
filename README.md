# VV DOUBLE · FB 貼文工具

週曆排程（每天 12:00／18:00／20:00，新品週／推廣週模板）→ 每格選貼文類型 → Shopline 找商品 → Dropbox 選圖（首圖可加色帶文字）→ 帶入本週活動＋reurl 短網址 → AI 文案＋符號面板 → 發布或排程到 Facebook 粉專，並記錄貼文 ID 與成效。

- 網頁：https://yuu7073.github.io/vvdouble-fbpost/ （GitHub Pages，`index.html`）
- 中間站：Cloud Function `fbpost`（Firebase 專案 vvdouble-shopline，codebase `fbpost`，資料在 `/fbpost/`）
- 推上 `main` 後由 GitHub Actions 自動部署 function（`.github/workflows/deploy.yml`）
- 各家 Token 在工具「設定」頁填入，存於資料庫後端
