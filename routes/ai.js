const express = require("express");
const router = express.Router();


router.post("/generate", async (req, res) => {
  console.log("🔥 AI ROUTE HIT");
  console.log("🔥 BODY:", req.body);
  console.log("🔥 GEMINI KEY:", process.env.GEMINI_API_KEY);

  // ❌ agar key missing hai to yahin ruk jao
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing on server"
    });
  }

  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
Generate:
1. SEO title
2. 5 tags
3. Short outline

Topic:
${content}

Return ONLY valid JSON like:
{
  "title": "",
  "tags": [],
  "outline": ""
}
`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("🔥 GEMINI API ERROR:", data);
      return res.status(500).json({
        error: data?.error?.message || "Gemini request failed"
      });
    }

    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({
        error: "Empty AI response"
      });
    }

    // 🧹 markdown cleanup
    text = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("🔥 JSON PARSE FAILED:", text);
      return res.status(500).json({
        error: "AI returned invalid JSON",
        raw: text
      });
    }

    return res.json(parsed);

  } catch (err) {
    console.error("🔥 AI SERVER ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router;
