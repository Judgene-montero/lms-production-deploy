export async function testBackend() {
  const res = await fetch("http://127.0.0.1:8000/");
  const data = await res.text();
  console.log("Backend says:", data);
}