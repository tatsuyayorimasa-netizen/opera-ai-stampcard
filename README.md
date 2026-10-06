# オペラシティビル様 AI研修 出席スタンプカード

受講者がスマホで開いて、名前とふりかえりアンケートを入れて押印するページです。記録は Google スプレッドシートにたまります。

## 構成
- `index.html` … 画面（GitHub Pages で公開）
- `apps-script/Code.gs` … 記録・集計・管理ページの処理（スプレッドシートの Apps Script に貼る）

## つなぎ方
1. スプレッドシートの Apps Script に `apps-script/Code.gs` を貼り付けて保存
2. 「デプロイ」→「デプロイを管理」→ 編集 →「新バージョン」でデプロイ（アクセス：全員）
3. 表示された `…/exec` のURLを、`index.html` の `var API_URL='…'` に貼る
4. GitHub の Settings → Pages → Branch を `main` / `(root)` にして保存

## 管理ページ
画面下の「管理」タブから。パスワードは Apps Script 側の `adminPassword` で設定します。このリポジトリのコードはダミーなので、本物のパスワードは GitHub に書かないでください。
