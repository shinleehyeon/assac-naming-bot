import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { handleChat } from "./lib/chat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "32kb" }));
app.use(express.static(join(__dirname, "dist")));

app.post("/api/chat", (req, res) => {
  void handleChat(req, res);
});

if (existsSync(join(__dirname, "dist/index.html"))) {
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(join(__dirname, "dist/index.html"));
  });
}

app.listen(port, () => {
  console.log(`ASSAC Naming Bot API: http://localhost:${port}`);
});
