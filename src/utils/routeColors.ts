export interface RouteCategory {
  id: string;
  name: string;
  shortName: string;
  color: string;
  fillColor: string;
  description: string;
  baseColorName: string;
}

export const CATEGORY_NAMES_STORAGE_KEY = 'complex_route_planner_color_names';

export const DEFAULT_ROUTE_CATEGORIES: RouteCategory[] = [
  {
    id: 'parade',
    name: 'Zelená',
    shortName: 'Zelená',
    color: '#2ebd7f', // Mobile app mint green
    fillColor: '#2ebd7f',
    description: 'Zelená barva trasy',
    baseColorName: 'Zelená',
  },
  {
    id: 'emergency',
    name: 'Červená',
    shortName: 'Červená',
    color: '#ef4444', // Red
    fillColor: '#f87171',
    description: 'Červená barva trasy',
    baseColorName: 'Červená',
  },
  {
    id: 'logistics',
    name: 'Oranžová',
    shortName: 'Oranžová',
    color: '#f59e0b', // Amber / Orange
    fillColor: '#fbbf24',
    description: 'Oranžová barva trasy',
    baseColorName: 'Oranžová',
  },
  {
    id: 'alternative',
    name: 'Modrá',
    shortName: 'Modrá',
    color: '#3b82f6', // Blue
    fillColor: '#60a5fa',
    description: 'Modrá barva trasy',
    baseColorName: 'Modrá',
  },
  {
    id: 'performers',
    name: 'Fialová',
    shortName: 'Fialová',
    color: '#8b5cf6', // Purple
    fillColor: '#a78bfa',
    description: 'Fialová barva trasy',
    baseColorName: 'Fialová',
  },
  {
    id: 'staff',
    name: 'Žlutá',
    shortName: 'Žlutá',
    color: '#eab308', // Yellow
    fillColor: '#fde047',
    description: 'Žlutá barva trasy',
    baseColorName: 'Žlutá',
  },
  {
    id: 'closure',
    name: 'Šedá',
    shortName: 'Šedá',
    color: '#64748b', // Slate
    fillColor: '#94a3b8',
    description: 'Šedá barva trasy',
    baseColorName: 'Šedá',
  },
];

// Mapping aliases for robust lookup
export const LEGACY_ID_MAP: Record<string, string> = {
  green: 'parade',
  red: 'emergency',
  orange: 'logistics',
  blue: 'alternative',
  purple: 'performers',
  yellow: 'staff',
  gray: 'closure',
  grey: 'closure',
};

/**
 * Loads custom user-defined names from localStorage.
 */
export function getCustomCategoryNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CATEGORY_NAMES_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load custom color names from localStorage:', err);
  }
  return {};
}

/**
 * Returns categories merged with user-defined names from localStorage.
 */
export function getSavedCategories(): RouteCategory[] {
  const customNames = getCustomCategoryNames();
  return DEFAULT_ROUTE_CATEGORIES.map((cat) => {
    const customName = customNames[cat.id];
    if (customName && customName.trim()) {
      return {
        ...cat,
        name: customName.trim(),
        shortName: customName.trim(),
        description: `${cat.baseColorName} barva`,
      };
    }
    return {
      ...cat,
      name: cat.baseColorName,
      shortName: cat.baseColorName,
      description: `${cat.baseColorName} barva trasy`,
    };
  });
}

/**
 * Saves a new name for a category to localStorage and returns updated list.
 * If newName is empty or equals the default base color name, custom name is removed.
 */
export function saveCustomCategoryName(id: string, newName: string): RouteCategory[] {
  const custom = getCustomCategoryNames();
  const canonicalId = LEGACY_ID_MAP[id] || id;
  const defaultItem = DEFAULT_ROUTE_CATEGORIES.find((c) => c.id === canonicalId);
  const trimmed = newName.trim();

  if (!trimmed || (defaultItem && trimmed.toLowerCase() === defaultItem.baseColorName.toLowerCase())) {
    delete custom[canonicalId];
  } else {
    custom[canonicalId] = trimmed;
  }

  try {
    localStorage.setItem(CATEGORY_NAMES_STORAGE_KEY, JSON.stringify(custom));
  } catch (err) {
    console.error('Failed to save custom color name to localStorage:', err);
  }

  return getSavedCategories();
}

/**
 * Resets all color names back to the default color names.
 */
export function resetCustomCategoryNames(): RouteCategory[] {
  try {
    localStorage.removeItem(CATEGORY_NAMES_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to reset custom color names:', err);
  }
  return getSavedCategories();
}

export const ROUTE_CATEGORIES: RouteCategory[] = getSavedCategories();
export const DEFAULT_CATEGORY: RouteCategory = DEFAULT_ROUTE_CATEGORIES[0];

export function getCategoryById(id: string, categoriesList?: RouteCategory[]): RouteCategory {
  const list = categoriesList || getSavedCategories();
  const canonicalId = LEGACY_ID_MAP[id] || id;
  return list.find((c) => c.id === canonicalId) || list[0] || DEFAULT_CATEGORY;
}

export function getCategoryByColor(color: string, categoriesList?: RouteCategory[]): RouteCategory {
  const list = categoriesList || getSavedCategories();
  if (!color) return list[0] || DEFAULT_CATEGORY;
  const normalized = color.toLowerCase();
  return (
    list.find(
      (c) => c.color.toLowerCase() === normalized || c.fillColor.toLowerCase() === normalized
    ) || list[0] || DEFAULT_CATEGORY
  );
}
