async function test() {
  const email = 'l1_agent@kanvtech.com';
  const pass = 'Password@123';
  console.log('Testing login for:', email);
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass })
  });
  console.log('HTTP Status:', res.status);
  const text = await res.text();
  console.log('Response body:', text);
}
test();
