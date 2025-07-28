// generateHash.js
import bcrypt from 'bcryptjs'; // Or use 'bcrypt' if you prefer

const generateHash = async () => {
  const password = 'admin123'; // Replace with your password
  const hash = await bcrypt.hash(password, 10);
  console.log('✅ Hashed Password:', hash);
};

generateHash();
