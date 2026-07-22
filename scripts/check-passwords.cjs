const bcrypt = require('bcryptjs');

const adminHash = '$2b$12$NxR6kWZbcJenfaU1NzJ12uvMGALEJMAryi0HmZeSX4e6CRGUbyBJW';
const cashierHash = '$2b$12$FRy4C1aMvbLhoNR3wgRCoOW24n4.BGqT46Jr3.iOKraovzpT/tu4G';

const passwords = ['ChangeMe123!', 'change-me-in-production', 'admin123', 'password', 'admin', ''];

async function check() {
  for (const p of passwords) {
    const adminMatch = await bcrypt.compare(p, adminHash);
    const cashierMatch = await bcrypt.compare(p, cashierHash);
    console.log(`Password: "${p}" => admin: ${adminMatch}, cashier: ${cashierMatch}`);
  }
}

check().catch(console.error);
