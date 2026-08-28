fetch('http://localhost:3000/api/blast-radius?name=payment-gateway&type=Service')
  .then(res => res.json())
  .then(data => console.log('API Response:', JSON.stringify(data, null, 2)))
  .catch(console.error);
