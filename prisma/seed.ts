import "dotenv/config";
// Kalau TIDAK pakai src/, ganti jadi "../app/generated/prisma/client"
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const HOUR = 60 * 60 * 1000;
const SLA_HOURS = { URGENT: 4, HIGH: 8, MEDIUM: 24, LOW: 72 } as const;

const people = [
  ["Admin Helpdesk", "ADMIN"],
  ["Jason Duong", "AGENT"],
  ["Nhi Pham", "AGENT"],
  ["Annie Nguyen", "AGENT"],
  ["Bao Truong", "AGENT"],
  ["Lam Tran", "AGENT"],
  ["Thanh Le", "AGENT"],
  ["Rina Putri", "REQUESTER"],
  ["Dimas Pratama", "REQUESTER"],
  ["Sari Wulandari", "REQUESTER"],
] as const;

const requesters = ["Rina Putri", "Dimas Pratama", "Sari Wulandari"];

const categoryNames = [
  "Hardware",
  "Software",
  "Jaringan",
  "Akun & Akses",
  "Email",
  "Lainnya",
];

// [subject, status, priority, assignee, category, channel, jam yang lalu]
const tickets = [
  ["Laptop tidak menyala setelah update BIOS", "OPEN", "HIGH", "Jason Duong", "Hardware", "PHONE", 3],
  ["VPN gagal terhubung dari rumah", "OPEN", "URGENT", "Jason Duong", "Jaringan", "CHAT", 2],
  ["Printer lantai 2 tidak terdeteksi", "OPEN", "MEDIUM", "Annie Nguyen", "Hardware", "WEB", 6],
  ["Permintaan instalasi Adobe Acrobat Pro", "OPEN", "LOW", null, "Software", "EMAIL", 10],
  ["Akun terkunci setelah salah password berulang", "OPEN", "URGENT", null, "Akun & Akses", "PHONE", 5],
  ["Wi-Fi ruang rapat sangat lambat", "OPEN", "HIGH", "Bao Truong", "Jaringan", "SLACK", 9],
  ["Email gagal mengirim lampiran besar", "OPEN", "MEDIUM", null, "Email", "EMAIL", 20],
  ["Monitor kedua tidak terdeteksi", "OPEN", "LOW", "Lam Tran", "Hardware", "CHAT", 12],
  ["Permintaan akses folder shared Keuangan", "PENDING", "HIGH", "Jason Duong", "Akun & Akses", "EMAIL", 6],
  ["Aplikasi ERP error saat export laporan", "PENDING", "HIGH", "Nhi Pham", "Software", "EMAIL", 7],
  ["Penggantian keyboard rusak", "PENDING", "MEDIUM", "Thanh Le", "Hardware", "CHAT", 18],
  ["Setup email untuk karyawan baru", "PENDING", "MEDIUM", "Annie Nguyen", "Email", "WEB", 30],
  ["Lisensi Office hampir habis", "PENDING", "LOW", "Lam Tran", "Software", "SLACK", 40],
  ["Reset password VPN", "RESOLVED", "MEDIUM", "Bao Truong", "Akun & Akses", "CHAT", 26],
  ["Install ulang antivirus", "RESOLVED", "LOW", "Nhi Pham", "Software", "WEB", 48],
  ["Kabel LAN putus di meja 14", "RESOLVED", "MEDIUM", "Thanh Le", "Jaringan", "PHONE", 30],
  ["Webcam tidak berfungsi saat meeting", "RESOLVED", "LOW", "Lam Tran", "Hardware", "SLACK", 50],
  ["Permintaan mouse wireless", "CLOSED", "LOW", "Annie Nguyen", "Hardware", "WEB", 100],
  ["Update Windows gagal berulang", "CLOSED", "MEDIUM", "Jason Duong", "Software", "CHAT", 72],
  ["Pindah meja dan setup jaringan", "CLOSED", "LOW", "Bao Truong", "Jaringan", "EMAIL", 120],
] as const;

async function main() {
  await prisma.comment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const users: Record<string, { id: string }> = {};
  for (const [name, role] of people) {
    const email = name.toLowerCase().replace(/\s+/g, ".") + "@helpdesk.local";
    users[name] = await prisma.user.create({
      data: { name, email, role, passwordHash },
    });
  }

  const categories: Record<string, { id: string }> = {};
  for (const name of categoryNames) {
    categories[name] = await prisma.category.create({ data: { name } });
  }

  const now = Date.now();
  for (const [i, t] of tickets.entries()) {
    const [subject, status, priority, assignee, category, channel, hoursAgo] = t;
    const createdAt = new Date(now - hoursAgo * HOUR);
    const done = status === "RESOLVED" || status === "CLOSED";

    await prisma.ticket.create({
      data: {
        subject,
        description: `${subject}. Mohon bantuan penanganan dari tim IT.`,
        status,
        priority,
        channel,
        requesterId: users[requesters[i % requesters.length]].id,
        assigneeId: assignee ? users[assignee].id : null,
        categoryId: categories[category].id,
        createdAt,
        dueAt: new Date(createdAt.getTime() + SLA_HOURS[priority] * HOUR),
        resolvedAt: done ? new Date(createdAt.getTime() + 3 * HOUR) : null,
      },
    });
  }

  console.log("Seed selesai: 10 user, 6 kategori, 20 tiket");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());