// Captions transcribed from the supplied 08:00 строевая записка.
export const rosterReasons = [
  { code: 'DUTY_DETAIL', name: 'Наряд', category: 'IN_INSTITUTE' },
  { code: 'REGIME_POST', name: 'Пост. режим', category: 'IN_INSTITUTE' },
  { code: 'INFIRMARY', name: 'Лазарет', category: 'IN_INSTITUTE' },
  { code: 'IN_FORMATION', name: 'В строю', category: 'IN_INSTITUTE' },
  { code: 'ZUB', name: 'ЗУБ', category: 'OUTSIDE' },
  { code: 'VACATION', name: 'Отпуск', category: 'OUTSIDE' },
  { code: 'HOSPITAL', name: 'Госпиталь', category: 'OUTSIDE' },
  { code: 'HOME_TREATMENT', name: 'Дом. лечение', category: 'OUTSIDE' },
  { code: 'DISMISSAL', name: 'Увольнение', category: 'OUTSIDE' },
  { code: 'BUSINESS_TRIP', name: 'Командировка', category: 'OUTSIDE' },
  { code: 'WITHOUT_UP', name: 'Без УП', category: 'OUTSIDE' },
  { code: 'PRACTICE', name: 'Практика', category: 'OUTSIDE' },
] as const;
