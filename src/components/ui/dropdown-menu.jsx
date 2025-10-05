import React, { createContext, useContext, useState, useRef, useEffect } from "react";

const DropdownMenuContext = createContext();

export function DropdownMenu({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen, dropdownRef }}>
      <div ref={dropdownRef} className="relative inline-block">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({ children, asChild }) {
  const { isOpen, setIsOpen } = useContext(DropdownMenuContext);

  const handleClick = () => setIsOpen(!isOpen);

  if (asChild) {
    return React.cloneElement(children, {
      onClick: handleClick,
    });
  }

  return (
    <button onClick={handleClick}>
      {children}
    </button>
  );
}

export function DropdownMenuContent({ children, align = "start" }) {
  const { isOpen } = useContext(DropdownMenuContext);

  if (!isOpen) return null;

  const alignmentClass = align === "end" ? "right-0" : "left-0";

  return (
    <div
      className={`absolute ${alignmentClass} mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50`}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ children, onClick }) {
  const { setIsOpen } = useContext(DropdownMenuContext);

  const handleClick = () => {
    onClick?.();
    setIsOpen(false);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {children}
    </button>
  );
}
