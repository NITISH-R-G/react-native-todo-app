import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { displayCategory, normalizeCategory } from '../domain/filters';
import { shape, spacing } from '../design/tokens';
import { ChipRow, FilterChip } from './Chips';

/**
 * Pick one of the existing categories or create a new one. Categories are stored as the task's first
 * tag on the server, so they persist across restarts and devices; a category with no tasks disappears
 * (except the defaults).
 */
export function CategoryPicker({
  value,
  categories,
  onChange,
  disabled,
}: {
  value: string;
  categories: string[];
  onChange: (c: string) => void;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const options = categories.includes(value) ? categories : [...categories, value];

  const commit = () => {
    const c = normalizeCategory(draft);
    if (c) onChange(c);
    setDraft('');
    setAdding(false);
  };

  return (
    <View>
      <ChipRow label="Category">
        {options.map((c) => (
          <FilterChip key={c} label={displayCategory(c)} icon="tag-outline" selected={value === c} onPress={() => !disabled && onChange(c)} testID={`category-${c}`} />
        ))}
        <FilterChip label="New" icon="plus" selected={false} onPress={() => !disabled && setAdding(true)} testID="category-new" />
      </ChipRow>
      {adding ? (
        <View style={styles.add}>
          <TextInput
            mode="outlined"
            label="New category"
            value={draft}
            onChangeText={setDraft}
            maxLength={30}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={commit}
            outlineStyle={styles.outline}
            style={styles.flex}
            testID="category-input"
          />
          <Button mode="contained-tonal" onPress={commit} style={styles.addBtn} testID="category-add">
            Add
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  add: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.sm, gap: spacing.sm },
  outline: { borderRadius: shape.large },
  addBtn: { borderRadius: shape.full },
});
