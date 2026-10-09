import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Menu } from 'react-native-paper';
import { availableCategories, displayCategory, statusCounts, type SortMode, type StatusFilter } from '../domain/filters';
import { spacing } from '../design/tokens';
import { useTasks } from '../state/tasksStore';
import { ChipRow, FilterChip } from './Chips';

const STATUS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
];
const SORTS: { key: SortMode; label: string; icon: string }[] = [
  { key: 'smart', label: 'Smart (priority + deadline)', icon: 'sort-variant' },
  { key: 'deadline', label: 'Nearest deadline', icon: 'calendar-clock' },
  { key: 'created', label: 'Newest first', icon: 'clock-plus-outline' },
];

/** Status chips (with live counts), category chips and a sort menu. Filters compose with AND. */
export function FilterBar() {
  const { tasks, filters, sort, setFilters, setSort } = useTasks();
  const [menu, setMenu] = useState(false);
  const now = new Date();
  const counts = useMemo(() => statusCounts(tasks, filters.category, now), [tasks, filters.category]); // eslint-disable-line react-hooks/exhaustive-deps
  const categories = useMemo(() => availableCategories(tasks), [tasks]);
  return (
    <View>
      <View style={styles.top}>
        <View style={styles.flex}>
          <ChipRow label="Filter by status">
            {STATUS.map((s) => (
              <FilterChip
                key={s.key}
                label={`${s.label} ${counts[s.key]}`}
                selected={filters.status === s.key}
                onPress={() => setFilters({ status: s.key })}
                testID={`filter-status-${s.key}`}
              />
            ))}
          </ChipRow>
        </View>
        <Menu
          visible={menu}
          onDismiss={() => setMenu(false)}
          anchor={
            <IconButton
              icon="sort"
              size={24}
              onPress={() => setMenu(true)}
              accessibilityLabel={`Sort tasks. Current: ${SORTS.find((s) => s.key === sort)?.label}`}
              testID="sort-button"
            />
          }>
          {SORTS.map((s) => (
            <Menu.Item
              key={s.key}
              leadingIcon={sort === s.key ? 'check' : s.icon}
              title={s.label}
              onPress={() => {
                setMenu(false);
                setSort(s.key);
              }}
              testID={`sort-${s.key}`}
            />
          ))}
        </Menu>
      </View>
      <ChipRow label="Filter by category">
        <FilterChip label="All categories" selected={filters.category === null} onPress={() => setFilters({ category: null })} testID="filter-category-all" />
        {categories.map((c) => (
          <FilterChip
            key={c}
            label={displayCategory(c)}
            icon="tag-outline"
            selected={filters.category === c}
            onPress={() => setFilters({ category: filters.category === c ? null : c })}
            testID={`filter-category-${c}`}
          />
        ))}
      </ChipRow>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm },
});
