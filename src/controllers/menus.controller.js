import prisma from "../../prisma/client.js";
import { deleteImage, upload } from "../middleware/cloudinary.js";

export const getMenu = async (req, res) => {
    try {
        const data = await prisma.menu.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createMenu = async (req, res) => {
    try {
        const photoFile = req.file;
        const { name, price, description } = req.body;

        if (!photoFile || !description || !name || !price) {
            return res.status(400).json({ message: `Kolom ${!photoFile ? "Foto" : !description ? "Deskripsi" : !name ? "Nama" : "Harga"} harus diisi` });
        }

        const cloudinaryPhoto = await upload(photoFile, "menus");

        const data = await prisma.menu.create({
            data: {
                name,
                description,
                price: Number(price),
                photo: cloudinaryPhoto.url
            }
        });

        res.status(201).json({ message: "Menu dibuat", data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateMenu = async (req, res) => {
    try {
        const { id } = req.params;
        const photoFile = req.file;
        const { name, price, description, photo } = req.body;

        const existing = await prisma.menu.findUnique({
            where: { id: Number(id) },
        });

        if (!existing) {
            return res.status(404).json({ message: "Menu tidak ditemukan" });
        }

        if (!description || !name || !price) {
            return res.status(400).json({ message: `Kolom ${!description ? "Deskripsi" : !name ? "Nama" : "Harga"} harus diisi` });
        }

        let fotoUrl = existing.photo;

        // Kalo up file baru
        if (photoFile) {
            const publicId = existing.photo.split("/").pop().split(".")[0];
            const publicFolder = existing.photo.split("/").slice(-2, -1)[0];

            await deleteImage(publicId, publicFolder);
            const uploadResult = await upload(photoFile, "menus"); // Konsisten gunakan folder "menus"
            fotoUrl = uploadResult.url;
        }
        // kalo pake foto lama kirim string
        else if (photo && typeof photo === "string" && photo.trim() !== "") {
            fotoUrl = photo;
        }

        const data = await prisma.menu.update({
            where: { id: Number(id) },
            data: {
                name,
                description,
                price: Number(price),
                photo: fotoUrl
            }
        });

        res.json({ message: "Menu diperbarui", data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteMenu = async (req, res) => {
    // Variabel untuk menyimpan data foto yang sah untuk dihapus (jika DB sukses)
    let photosToDelete = [];

    try {
        // 1. Validasi Input
        if (!req.body.id || !Array.isArray(req.body.id)) {
            return res.status(400).json({ message: "ID menu tidak valid" });
        }

        const idsToDelete = req.body.id.map(Number);

        // 2. Ambil data menu sebelum dihapus untuk mendapatkan URL fotonya
        const menus = await prisma.menu.findMany({
            where: { id: { in: idsToDelete } },
        });

        if (menus.length === 0) {
            return res.status(404).json({ message: "Menu tidak ditemukan" });
        }

        // Simpan URL fotonya ke memori (JANGAN dihapus dulu!)
        photosToDelete = menus
            .map(menu => menu.photo)
            .filter(photo => photo); // Buang yang null/kosong

        // 3. EKSEKUSI DATABASE UTAMA
        // Jika gagal karena Foreign Key Constraint (P2003), 
        // akan langsung terlempar ke blok `catch` di bawah.
        await prisma.menu.deleteMany({
            where: { id: { in: idsToDelete } }
        });

    } catch (error) {
        // TANGKAP ERROR DATABASE DI SINI
        if (error.code === 'P2003') {
            return res.status(400).json({
                message: "Gagal menghapus: Menu ini tidak bisa dihapus karena sudah tercatat dalam riwayat pesanan."
            });
        }
        return res.status(500).json({ message: error.message });
    }

    // -------------------------------------------------------------
    // 4. ZONA AMAN CLOUDINARY
    // Jika eksekusi mencapai titik ini, BERARTI DATABASE SUDAH 100% SUKSES DIHAPUS.
    // Sekarang, aman untuk menghapus foto di Cloudinary.
    // -------------------------------------------------------------

    // Kita jalankan penghapusan Cloudinary secara background (tidak perlu await strict)
    // agar response ke client lebih cepat.
    for (const photoUrl of photosToDelete) {
        try {
            const publicId = photoUrl.split("/").pop().split(".")[0];
            const publicFolder = photoUrl.split("/").slice(-2, -1)[0];
            await deleteImage(publicId, publicFolder);
        } catch (cloudinaryErr) {
            console.warn(`[Cloudinary Warning] Gagal menghapus foto: ${photoUrl}`, cloudinaryErr.message);
        }
    }

    // Kembalikan response sukses
    return res.json({ message: "Menu beserta foto berhasil dihapus" });
};