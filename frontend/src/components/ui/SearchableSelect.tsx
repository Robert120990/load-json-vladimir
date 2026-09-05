import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

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

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filtered options based on query
  const queryClean = searchQuery.toLowerCase().trim();
  const filteredOptions = options.filter((opt) => {
    if (!queryClean) return true;
    const matchLabel = opt.label.toLowerCase().includes(queryClean);
    const matchSub = opt.subLabel ? opt.subLabel.toLowerCase().includes(queryClean) : false;
    const matchValue = opt.value.toLowerCase().includes(queryClean);
    const matchBadge = opt.badge ? opt.badge.toLowerCase().includes(queryClean) : false;
    return matchLabel || matchSub || matchValue || matchBadge;
  });

  function handleSelect(val: string) {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
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
            <Search size={15} className="searchable-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="searchable-search-input"
              placeholder="Escribe para buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                className="searchable-search-clear"
                onClick={() => setSearchQuery('')}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="searchable-options-list">
            {filteredOptions.length === 0 ? (
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
