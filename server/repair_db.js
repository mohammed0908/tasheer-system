import mysql from 'mysql2/promise';

async function main() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });

    console.log("Repairing mysql.db...");
    await connection.query("REPAIR TABLE mysql.db");
    console.log("Repair complete.");
    await connection.end();
  } catch (error) {
    console.error("Error:", error);
  }
}
main();
