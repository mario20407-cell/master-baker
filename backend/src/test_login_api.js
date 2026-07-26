async function test() {
  try {
    console.log('Probando peticion POST /api/auth/login localmente (127.0.0.1)...');
    const response = await fetch('http://127.0.0.1:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': '00000000-0000-0000-0000-000000000001'
      },
      body: JSON.stringify({
        email: 'admin@marquez.com',
        password: 'admin12345'
      })
    });
    
    console.log('Status:', response.status);
    const body = await response.json();
    console.log('Respuesta:', body);
  } catch (err) {
    console.error('Error al probar login API:', err.message);
  }
}

test();
