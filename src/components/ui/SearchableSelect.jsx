import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, X, Check, Plus, Loader2 } from "lucide-react";

/**
 * SearchableSelect / SearchableAddNewSelect
 * A searchable dropdown component with A-Z sorted options and "+ Add New" custom input support.
 */
const SearchableSelect = ({
  id,
  label,
  required = false,
  value = "",
  onChange,
  options = [],
  loading = false,
  placeholder,
  allowAddNew = true,
  isAdding = false,
  setIsAdding,
  onAddNew,
  onOptionSelect,
  disableChooseFromList = false,
  onChooseFromList,
  disabled = false,
  className = "",
  autoFocusOnAdd = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const plainLabel = (label || "").replace(/\*/g, "").trim();
  const selectPlaceholder = placeholder || `Select ${plainLabel}`;

  // Deduplicate, filter valid items, and sort A to Z
  const sortedOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    return [...new Set(options)]
      .filter((item) => item !== null && item !== undefined && String(item).trim() !== "")
      .map((item) => String(item).trim())
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
  }, [options]);

  // Filter options by search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return sortedOptions;
    const term = searchTerm.toLowerCase().trim();
    return sortedOptions.filter((item) => item.toLowerCase().includes(term));
  }, [sortedOptions, searchTerm]);

  // Handle clicking outside to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const handleSelectOption = (option) => {
    if (onChange) onChange(option);
    if (onOptionSelect) onOptionSelect(option);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleAddNew = () => {
    if (onAddNew) {
      onAddNew();
    } else {
      if (setIsAdding) setIsAdding(true);
      if (onChange) onChange("");
    }
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleChooseFromList = () => {
    if (onChooseFromList) {
      onChooseFromList();
    } else {
      if (setIsAdding) setIsAdding(false);
      if (onChange) onChange("");
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {isAdding ? (
        <div className="flex gap-2">
          <input
            type="text"
            id={id}
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={`Enter new ${plainLabel}`}
            required={required}
            autoFocus={autoFocusOnAdd}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
          />
          {!disableChooseFromList && (
            <button
              type="button"
              onClick={handleChooseFromList}
              className="text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap px-2 py-1 font-medium hover:underline"
            >
              Choose from list
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          {/* Hidden input to ensure HTML5 form validation works if required */}
          {required && (
            <input
              type="text"
              tabIndex={-1}
              value={value || ""}
              required={required}
              onChange={() => {}}
              className="sr-only opacity-0 absolute pointer-events-none -z-10 h-0 w-0"
            />
          )}

          {/* Trigger Button */}
          <button
            type="button"
            id={id}
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className={`w-full py-2 px-3 text-left rounded-md border shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between transition-colors text-sm ${
              disabled
                ? "bg-gray-100 cursor-not-allowed border-gray-300 text-gray-400"
                : isOpen
                ? "border-blue-500 ring-2 ring-blue-100"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <span className={`truncate mr-2 ${value ? "text-gray-900 font-normal" : "text-gray-400"}`}>
              {value || selectPlaceholder}
            </span>
            <div className="flex items-center space-x-1 shrink-0">
              {value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onChange) onChange("");
                    if (onOptionSelect) onOptionSelect("");
                  }}
                  className="p-0.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 cursor-pointer"
                  title="Clear selection"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                  isOpen ? "transform rotate-180 text-blue-600" : ""
                }`}
              />
            </div>
          </button>

          {/* Dropdown Popup Menu */}
          {isOpen && (
            <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 py-1 text-sm animate-in fade-in zoom-in-95 duration-100">
              {/* Search Box */}
              <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Search ${plainLabel}...`}
                    className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsOpen(false);
                      }
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerm("");
                        if (searchInputRef.current) searchInputRef.current.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Options List */}
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                {loading ? (
                  <div className="px-3 py-3 text-center text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Loading options...</span>
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-gray-400 italic">
                    No matching options found
                  </div>
                ) : (
                  filteredOptions.map((item, index) => {
                    const isSelected = item === value;
                    return (
                      <button
                        key={`${item}-${index}`}
                        type="button"
                        onClick={() => handleSelectOption(item)}
                        className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between ${
                          isSelected
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <span className="truncate mr-2">{item}</span>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Add New Option */}
              {allowAddNew && (
                <div className="border-t border-gray-100 p-1 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={handleAddNew}
                    className="w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1.5 font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add New</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
