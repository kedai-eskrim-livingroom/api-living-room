import prisma from "../../prisma/client.js";
import { createToken } from "../middleware/auth.js";
import bcrypt from "bcrypt";

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: `Kolom ${!email ? "Email" : "Password"} harus diisi` });
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(400).json({ message: "Email tidak terdaftar" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Password salah" });
        }

        const { password: _, ...userWithoutPassword } = user;

        const token = createToken(userWithoutPassword);

        return res.status(200).json({ message: "Login berhasil", token, user: userWithoutPassword });

    } catch (error) {
        return res.status(500).json({ message: "Terjadi kesalahan pada server", error: error.message });
    }
};