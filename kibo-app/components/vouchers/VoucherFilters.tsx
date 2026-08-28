'use client';

import {
  VOUCHER_CATEGORIES,
  VOUCHER_CATEGORY_LABELS,
} from '@/lib/constants';

interface VoucherFiltersProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'points_asc' | 'points_desc' | 'name';
  onSortChange: (sort: 'points_asc' | 'points_desc' | 'name') => void;
}

export default function VoucherFilters({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
}: VoucherFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-white/40">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search partners, cafes, discounts..."
            aria-label="Search partner vouchers"
            className="w-full rounded-2xl border border-white/15 bg-slate-950/60 py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-white/30 backdrop-blur-md focus:border-teal-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-white/40 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="voucher-sort" className="text-xs text-white/50">
            Sort by:
          </label>
          <select
            id="voucher-sort"
            value={sortBy}
            onChange={(e) =>
              onSortChange(
                e.target.value as 'points_asc' | 'points_desc' | 'name'
              )
            }
            className="rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-xs text-white backdrop-blur-md focus:border-teal-400 focus:outline-none"
          >
            <option value="points_asc">Points: Low to High</option>
            <option value="points_desc">Points: High to Low</option>
            <option value="name">Partner Name</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {VOUCHER_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          const label = VOUCHER_CATEGORY_LABELS[cat] || cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                isSelected
                  ? 'bg-teal-400/20 text-teal-200 border border-teal-400/50 shadow-sm'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
