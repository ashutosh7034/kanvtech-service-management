import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';

async function main() {
  const adminRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });
  const adminData = await adminRes.json();
  const token = adminData.token;

  const pRes = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code: 'DEB_PROD', name: 'Debug Product', category: 'TEST' }),
  });
  const pData = await pRes.json();
  const productId = pData.id;
  console.log('Created product:', productId);

  const cRes = await fetch(`${API_BASE}/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      company_name: 'Debug Co Inc',
      address: '123 Debug Way',
      primary_email: 'contact@debugco.com',
      contact_person: 'Debug Contact',
      contact_email: 'debug.user@debugco.com',
      contact_phone: '+919999999999',
      contact_password: 'Password@123',
      product_ids: [productId],
    }),
  });
  const cData = await cRes.json();
  console.log('Company creation response:', cRes.status, cData);

  const userInDb = await prisma.user.findFirst({
    where: { email: { equals: 'debug.user@debugco.com', mode: 'insensitive' } },
  });
  console.log('User in DB:', userInDb);
  if (userInDb) {
    const isMatch = await bcrypt.compare('Password@123', userInDb.passwordHash);
    console.log('Bcrypt direct match with Password@123:', isMatch);
  }

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'debug.user@debugco.com', password: 'Password@123' }),
  });
  console.log('Login API response:', loginRes.status, await loginRes.json());

  // Cleanup debug records
  await prisma.companyProduct.deleteMany({ where: { companyId: cData.companyId || cData.id } });
  await prisma.companyContact.deleteMany({ where: { companyId: cData.companyId || cData.id } });
  await prisma.company.deleteMany({ where: { id: cData.companyId || cData.id } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.user.deleteMany({ where: { email: 'debug.user@debugco.com' } });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
