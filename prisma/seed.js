import bcrypt from 'bcrypt';
import prisma from './client.js';

async function main() {
    console.log("Memulai proses seeding...");

    const saltRounds = 10;

    // Hash password untuk kedua akun
    const adminPassword = await bcrypt.hash('admin123', saltRounds);
    const penjagaPassword = await bcrypt.hash('kasir123', saltRounds);

    // 1. Buat Akun ADMIN
    // Menggunakan upsert agar jika di-run berkali-kali tidak error duplicate email
    const admin = await prisma.user.upsert({
        where: { email: 'admin@livingroom.com' },
        update: {}, // Jika email sudah ada, tidak melakukan apa-apa
        create: {
            email: 'admin@livingroom.com',
            password: adminPassword,
            role: 'ADMIN',
        },
    });

    // 2. Buat Akun PENJAGA (Kasir)
    const penjaga = await prisma.user.upsert({
        where: { email: 'kasir@livingroom.com' },
        update: {},
        create: {
            email: 'kasir@livingroom.com',
            password: penjagaPassword,
            role: 'PENJAGA',
        },
    });

    console.log("Seeding selesai! Data user berhasil dibuat:");
    console.log({
        admin: { email: admin.email, role: admin.role },
        penjaga: { email: penjaga.email, role: penjaga.role }
    });
}

main()
    .catch((e) => {
        console.error("Terjadi kesalahan saat seeding:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });