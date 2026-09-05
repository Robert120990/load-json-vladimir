import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { matchesSearchTokens } from '../../utils/searchUtils';

export interface SearchableOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  emptyText?: string;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  onSearch,
  isLoading = false,
  placeholder = 'Seleccionar...',
  disabled = false,
  hasError = false,
  emptyText = 'No se encontraron resultados',
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  function handleSearchInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setSearchQuery(text);
    if (onSearchRef.current) {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      searchTimerRef.current = setTimeout(() => {
        onSearchRef.current?.(text);
      }, 250);
    }
  }

  function resetSearch() {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (searchQuery) {
      setSearchQuery('');
      onSearchRef.current?.('');
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        resetSearch();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, searchQuery]);

  // When onSearch is provided, options are already filtered by the server.
  // When onSearch is not provided, filter locally in-memory.
  const filteredOptions = onSearch
    ? options
    : options.filter((opt) =>
        matchesSearchTokens([opt.label, opt.subLabel, opt.value, opt.badge], searchQuery)
      );

  function handleSelect(val: string) {
    onChange(val);
    setIsOpen(false);
    resetSearch();
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    resetSearch();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsOpen(false);
      resetSearch();
    }
  }

  return (
    <div
      ref={containerRef}
      className={`searchable-select-wrapper ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className={`form-input searchable-select-trigger ${
          hasError ? 'input-error' : ''
        } ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
      >
        <div className="searchable-select-text">
          {selectedOption ? (
            <div className="searchable-selected-item">
              <span className="searchable-selected-label">{selectedOption.label}</span>
              {selectedOption.subLabel && (
                <span className="searchable-selected-sublabel">
                  ({selectedOption.subLabel})
                </span>
              )}
            </div>
          ) : (
            <span className="searchable-placeholder">{placeholder}</span>
          )}
        </div>

        <div className="searchable-select-actions">
          {value && !disabled && (
            <button
              type="button"
              className="searchable-clear-btn"
              onClick={handleClear}
              title="Limpiar selección"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`searchable-chevron ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="searchable-select-dropdown">
          <div className="searchable-search-box">
            {isLoading ? (
              <Loader2 size={14} className="searchable-search-icon animate-spin text-blue-500" />
            ) : (
              <Search size={15} className="searchable-search-icon" />
            )}
            <input
              ref={searchInputRef}
              type="text"
              className="searchable-search-input"
              placeholder="Escribe para buscar..."
              value={searchQuery}
              onChange={handleSearchInputChange}
              onClick={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                className="searchable-search-clear"
                onClick={resetSearch}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="searchable-options-list">
            {isLoading && filteredOptions.length === 0 ? (
              <div className="searchable-no-results">Buscando…</div>
            ) : filteredOptions.length === 0 ? (
              <div className="searchable-no-results">{emptyText}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    className={`searchable-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <div className="searchable-option-main">
                      <div className="searchable-option-label">{opt.label}</div>
                      {opt.subLabel && (
                        <div className="searchable-option-sublabel">{opt.subLabel}</div>
                      )}
                    </div>
                    {opt.badge && (
                      <span className="badge badge-neutral text-xs">{opt.badge}</span>
                    )}
                    {isSelected && <Check size={16} className="text-primary" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

