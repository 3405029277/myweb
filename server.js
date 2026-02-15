import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Wispbyte 面板一般会给你一个“App Port”，你必须监听那个端口。
// 不确定环境变量名时，就用 PORT；面板里能设置的话也设置成同一个端口。
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// 让整个仓库目录作为静态站点目录（你的 html/js 就能直接访问）
app.use(express.static(__dirname));

app.get("/health", (_, res) => res.send("ok"));

app.listen(port, "0.0.0.0", () => {
  console.log("Server listening on port", port);
});
