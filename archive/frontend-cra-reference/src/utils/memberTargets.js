/** Zaznaczeni domownicy do operacji zapisu (kalendarz itd.). */
export function getTargetMemberIds(includedMemberIds, fallbackId) {
  if (includedMemberIds?.length) return includedMemberIds;
  return fallbackId ? [fallbackId] : [];
}

/** Jeden zaznaczony → on; więcej → profil główny (podgląd makro, rozkład, kalendarz). */
export function getViewMemberId(includedMemberIds, members, fallbackId) {
  if (includedMemberIds?.length === 1) return includedMemberIds[0];
  if (includedMemberIds?.length > 1) {
    return members.find(m => m.is_primary)?.id ?? includedMemberIds[0];
  }
  return fallbackId ?? null;
}
