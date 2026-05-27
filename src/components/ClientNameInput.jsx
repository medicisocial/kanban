export default function ClientNameInput({
  value,
  onChange,
  clients,
  inputClass,
  placeholder = 'Any client or project name',
  listId = 'client-name-suggestions',
  helperText = 'Pick an existing client or type a custom name.',
}) {
  return (
    <>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={inputClass}
        list={listId}
      />
      <datalist id={listId}>
        {clients.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </>
  );
}
