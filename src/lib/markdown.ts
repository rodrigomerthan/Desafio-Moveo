export function sheetUserToMarkdown(user: Record<string, any>) {
  const lines: string[] = [];
  lines.push("### Perfil do usuário (Google Sheets)\n");

  Object.keys(user)
    .filter((k) => !k.startsWith("_")) // ignora _rowIndex
    .forEach((key) => {
      lines.push(`- **${key}:** ${user[key]}`);
    });

  return lines.join("\n");
}
