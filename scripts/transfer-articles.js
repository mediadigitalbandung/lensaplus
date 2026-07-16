// Transfer all articles from Ahmad Fauzi to Yedi Supriadi, then delete Ahmad Fauzi
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 1. Find both users
  const ahmad = await prisma.user.findFirst({ where: { name: { contains: "Ahmad Fauzi" } } });
  const yedi = await prisma.user.findFirst({ where: { name: { contains: "Yedi Supriadi" } } });

  if (!ahmad) {
    console.log("ERROR: Ahmad Fauzi not found!");
    return;
  }
  if (!yedi) {
    console.log("ERROR: Yedi Supriadi not found!");
    return;
  }

  console.log("Ahmad Fauzi:", { id: ahmad.id, name: ahmad.name, role: ahmad.role });
  console.log("Yedi Supriadi:", { id: yedi.id, name: yedi.name, role: yedi.role });

  // 2. Count Ahmad's articles
  const articleCount = await prisma.article.count({ where: { authorId: ahmad.id } });
  console.log(`\nAhmad has ${articleCount} articles to transfer.`);

  // 3. Transfer all articles to Yedi
  const transferred = await prisma.article.updateMany({
    where: { authorId: ahmad.id },
    data: { authorId: yedi.id },
  });
  console.log(`Transferred ${transferred.count} articles to Yedi Supriadi.`);

  // 4. Update articles where Ahmad was reviewer
  const reviewerUpdated = await prisma.article.updateMany({
    where: { reviewedBy: ahmad.id },
    data: { reviewedBy: yedi.id },
  });
  console.log(`Updated ${reviewerUpdated.count} articles where Ahmad was reviewer.`);

  // 5. Update articles where Ahmad was assigned editor
  const editorUpdated = await prisma.article.updateMany({
    where: { assignedEditorId: ahmad.id },
    data: { assignedEditorId: yedi.id },
  });
  console.log(`Updated ${editorUpdated.count} articles where Ahmad was assigned editor.`);

  // 6. Transfer audit logs to Yedi (so we don't lose history)
  const auditUpdated = await prisma.auditLog.updateMany({
    where: { userId: ahmad.id },
    data: { userId: yedi.id },
  });
  console.log(`Transferred ${auditUpdated.count} audit logs to Yedi.`);

  // 7. Transfer notifications
  const notifsUpdated = await prisma.notification.updateMany({
    where: { userId: ahmad.id },
    data: { userId: yedi.id },
  });
  console.log(`Transferred ${notifsUpdated.count} notifications to Yedi.`);

  // 8. Transfer media uploads
  const mediaUpdated = await prisma.media.updateMany({
    where: { uploadedBy: ahmad.id },
    data: { uploadedBy: yedi.id, uploaderName: yedi.name },
  });
  console.log(`Transferred ${mediaUpdated.count} media files to Yedi.`);

  // 9. Transfer AI usage logs
  const aiUpdated = await prisma.aIUsageLog.updateMany({
    where: { userId: ahmad.id },
    data: { userId: yedi.id, userName: yedi.name },
  });
  console.log(`Transferred ${aiUpdated.count} AI usage logs to Yedi.`);

  // 10. Delete Ahmad Fauzi
  await prisma.user.delete({ where: { id: ahmad.id } });
  console.log(`\n✅ Ahmad Fauzi (${ahmad.id}) has been deleted.`);
  console.log(`✅ All data transferred to Yedi Supriadi (${yedi.id}).`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  prisma.$disconnect();
  process.exit(1);
});
