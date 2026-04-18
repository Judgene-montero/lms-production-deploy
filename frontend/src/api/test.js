export async function testBackend() {
  try {
    const res = await fetch("http://127.0.0.1:8000/users/api/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "admin123"
      })
    });

    const data = await res.json();
    console.log("✅ JWT Response:", data);

    // Now use the access token to fetch protected data
    const protectedRes = await fetch("http://127.0.0.1:8000/users/", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${data.access}`
      }
    });

    const protectedData = await protectedRes.json();
    console.log("🔐 Protected data:", protectedData);

  } catch (err) {
    console.error("❌ Failed to connect to backend:", err);
  }
}
