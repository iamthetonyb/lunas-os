'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  variant?: 'default' | 'danger';
  requiresNotes?: boolean;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  emptyStateLabel?: string;
  allowCreate?: boolean;
  onCreateOption?: (name: string) => Promise<string | void>;
  createLabel?: string;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  emptyStateLabel = 'No matches',
  allowCreate,
  onCreateOption,
  createLabel = 'Create',
}: SearchableSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    setQuery(selectedOption?.label ?? '');
  }, [selectedOption?.label]);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = (text?: string) =>
      text ? text.toLowerCase().startsWith(normalized) : false;
    const subset = normalized
      ? options.filter((option) => matches(option.label) || matches(option.description))
      : options;
    return subset.slice(0, 20);
  }, [options, query]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current || containerRef.current.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
      if (selectedOption) {
        setQuery(selectedOption.label);
      } else {
        setQuery('');
        if (value) {
          onChange('');
        }
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onChange, selectedOption, value]);

  const handleSelect = (option: SelectOption) => {
    onChange(option.value);
    setQuery(option.label);
    setIsOpen(false);
  };

  const canCreate = allowCreate && onCreateOption && query.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  const handleCreate = async () => {
    if (!onCreateOption || isCreating) return;
    const name = query.trim();
    setIsCreating(true);
    try {
      const newId = await onCreateOption(name);
      if (newId) {
        onChange(newId);
        setQuery(name);
      }
      setIsOpen(false);
    } catch {
      // error handled by caller
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setQuery(nextValue);
    setIsOpen(true);

    if (!nextValue) {
      onChange('');
      return;
    }

    const exactMatch = options.find(
      (option) => option.label.toLowerCase() === nextValue.trim().toLowerCase()
    );
    if (!exactMatch) {
      onChange('');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {isOpen && !disabled && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = option.value === value;
              const isDanger = option.variant === 'danger';
              const selectedClasses = isDanger
                ? 'bg-red-50 text-red-700'
                : 'bg-blue-50 text-blue-700';
              const hoverClasses = isDanger
                ? 'hover:bg-red-50 hover:text-red-600'
                : 'hover:bg-gray-50 hover:text-blue-600';
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm transition ${
                    isSelected ? selectedClasses : `${hoverClasses} ${
                      isDanger ? 'text-red-600' : 'text-gray-700'
                    }`
                  }`}
                  onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) => {
                    event.preventDefault();
                    handleSelect(option);
                  }}
                >
                  <span className="font-medium">{option.label}</span>
                  {option.description && (
                    <span
                      className={`text-xs ${
                        isDanger ? 'text-red-500' : 'text-gray-500'
                      }`}
                    >
                      {option.description}
                    </span>
                  )}
                </button>
              );
            })
          ) : canCreate ? null : (
            <div className="px-3 py-2 text-sm text-gray-500">{emptyStateLabel}</div>
          )}
          {canCreate && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-green-700 hover:bg-green-50 transition border-t border-gray-100"
              onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                handleCreate();
              }}
              disabled={isCreating}
            >
              <span className="text-green-500 font-bold">+</span>
              <span className="font-medium">
                {isCreating ? 'Creating...' : `${createLabel} "${query.trim()}"`}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type SearchableMultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
};

export function SearchableMultiSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: SearchableMultiSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const availableOptions = useMemo(() => new Set(options.map((option) => option.value)), [options]);

  useEffect(() => {
    if (!value) return;
    const sanitized = value.filter((val) => availableOptions.has(val));
    if (sanitized.length !== value.length) {
      onChange(sanitized);
    }
  }, [availableOptions, onChange, value]);

  const selectedOptions = useMemo(
    () => options.filter((option) => value?.includes(option.value)),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = (text?: string) =>
      text ? text.toLowerCase().startsWith(normalized) : false;
    const subset = options.filter(
      (option) =>
        !value?.includes(option.value) &&
        (normalized ? matches(option.label) || matches(option.description) : true)
    );
    return subset.slice(0, 20);
  }, [options, query, value]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current || containerRef.current.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleOption = (option: SelectOption) => {
    if (value?.includes(option.value)) {
      onChange(value.filter((val) => val !== option.value));
    } else {
      onChange([...(value ?? []), option.value]);
    }
    setQuery('');
    setIsOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !query && value?.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex min-h-[42px] w-full flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 transition ${
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-100'
            : 'border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500'
        }`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
          }
        }}
      >
        {selectedOptions.map((option) => {
          const isDanger = option.variant === 'danger';
          const chipClasses = isDanger
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-blue-50 text-blue-700 border border-blue-100';
          const closeButtonClasses = isDanger
            ? 'text-red-500 hover:text-red-700'
            : 'text-blue-500 hover:text-blue-700';
          return (
            <span
              key={option.value}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${chipClasses}`}
            >
              {option.label}
              <button
                type="button"
                className={closeButtonClasses}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(value.filter((val) => val !== option.value));
                }}
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedOptions.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 border-none bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
        />
      </div>
      {isOpen && !disabled && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isDanger = option.variant === 'danger';
              const hoverClasses = isDanger
                ? 'hover:bg-red-50 hover:text-red-600'
                : 'hover:bg-gray-50 hover:text-blue-600';
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm transition ${
                    isDanger ? `text-red-600 ${hoverClasses}` : `text-gray-700 ${hoverClasses}`
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    toggleOption(option);
                  }}
                >
                  <span className="font-medium">{option.label}</span>
                  {option.description && (
                    <span
                      className={`text-xs ${
                        isDanger ? 'text-red-500' : 'text-gray-500'
                      }`}
                    >
                      {option.description}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
