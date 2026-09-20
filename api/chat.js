import { handleChat } from "../lib/chat.js";

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST만 허용됩니다." });
    return;
  }

  await handleChat(req, res);
}
