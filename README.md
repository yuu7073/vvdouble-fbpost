# VV DOUBLE · FB 貼文工具

Shopline 找商品 → Dropbox 選圖／banner → AI 文案 → 帶 UTM 連結 → 發布或排程到 Facebook 粉專，並記錄貼文 ID 與成效。

- 網頁：https://yuu7073.github.io/vvdouble-fbpost/ （GitHub Pages，`index.html`）
- 中間站：Cloud Function `fbpost`（Firebase 專案 vvdouble-shopline，codebase `fbpost`，資料在 `/fbpost/`）
- 推上 `main` 後由 GitHub Actions 自動部署 function（`.github/workflows/deploy.yml`）
- 各家 Token 在工具「設定」頁填入，存於資料庫後端
