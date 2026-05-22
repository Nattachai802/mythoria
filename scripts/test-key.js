require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ ERROR: GEMINI_API_KEY is not defined in .env");
  process.exit(1);
}

console.log(`🔑 Testing API Key: ${apiKey.substring(0, 8)}... (Length: ${apiKey.length})`);

async function testKey() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: "Hello! Confirm if this API key is active by saying 'Active'." }] }]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("\n❌ API Test Failed!");
      console.error(JSON.stringify(data, null, 2));
    } else {
      console.log("\n✅ API Test Succeeded!");
      console.log("----------------------------------------");
      console.log("Gemini Response:", data.candidates[0].content.parts[0].text.trim());
      console.log("----------------------------------------");
    }
  } catch (error) {
    console.error("❌ Request error:", error);
  }
}

testKey();
