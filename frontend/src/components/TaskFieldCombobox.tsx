interface Props {
  listId: string
  label: string
  value: string
  suggestions: string[]
  readOnly?: boolean
  onCommit: (value: string | null) => void
}

export function TaskFieldCombobox({
  listId,
  label,
  value,
  suggestions,
  readOnly,
  onCommit,
}: Props) {
  return (
    <label>
      {label}
      <input
        key={`${listId}-${value}`}
        list={readOnly ? undefined : listId}
        defaultValue={value}
        readOnly={readOnly}
        className={readOnly ? 'readonly-field' : undefined}
        onBlur={(e) => {
          if (readOnly) return
          const trimmed = e.target.value.trim()
          onCommit(trimmed || null)
        }}
      />
      {!readOnly && (
        <datalist id={listId}>
          {suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </label>
  )
}
