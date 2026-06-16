export function canEditRecord(user, record) {
  if (!user || !record) return false;
  if (user.role === "admin") return true;
  if (record.authorId && record.authorId === user.id) return true;
  return Boolean(record.author && record.author === user.name);
}
