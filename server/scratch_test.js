async function test() {
  try {
    const salt = await import('bcryptjs').then(m => m.default ? m.default : m).then(bcrypt => bcrypt.genSalt(10));
    const bcrypt = await import('bcryptjs').then(m => m.default ? m.default : m);
    const hashedPassword = await bcrypt.hash('password123', salt);
    console.log('hash:', hashedPassword);
  } catch(e) {
    console.error('ERROR:', e);
  }
}
test();
