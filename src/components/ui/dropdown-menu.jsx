import React, { createContext, useContext, useState, useRef, useEffect, useId, useCallback } from "react";

// A menu button (WAI-ARIA "menu button" pattern). Unlike the Select's
// listbox, focus genuinely moves into the menu when it opens: the items are
// real buttons, arrow keys rove between them, Home/End jump to the ends,
// Escape closes and returns focus to the trigger, and Tab closes the menu
// on the way out so nothing is left floating.

const DropdownMenuContext = createContext();

export function DropdownMenu({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  // Where focus should land the next time the menu opens: 'first' for
  // click / Enter / Space / ArrowDown, 'last' for ArrowUp.
  const pendingFocus = useRef("first");

  const close = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const open = useCallback((where = "first") => {
    pendingFocus.current = where;
    setIsOpen(true);
  }, []);

  // Click outside closes without stealing focus back.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        close(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close]);

  return (
    <DropdownMenuContext.Provider
      value={{ isOpen, open, close, triggerRef, menuRef, menuId, pendingFocus }}
    >
      <div ref={dropdownRef} className="relative inline-block">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({ children, asChild }) {
  const { isOpen, open, close, triggerRef, menuId } = useContext(DropdownMenuContext);

  const handleClick = () => (isOpen ? close() : open("first"));

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      open("last");
    }
  };

  const ariaProps = {
    "aria-haspopup": "menu",
    "aria-expanded": isOpen,
    "aria-controls": isOpen ? menuId : undefined,
  };

  if (asChild) {
    return React.cloneElement(children, {
      ref: triggerRef,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      ...ariaProps,
    });
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...ariaProps}
    >
      {children}
    </button>
  );
}

const itemSelector = '[role="menuitem"]:not([disabled])';

export function DropdownMenuContent({ children, align = "start", "aria-label": ariaLabel }) {
  const { isOpen, close, menuRef, menuId, pendingFocus } = useContext(DropdownMenuContext);

  // Move focus into the menu once it has rendered.
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll(itemSelector);
    if (items.length === 0) return;
    const target = pendingFocus.current === "last" ? items[items.length - 1] : items[0];
    target.focus();
  }, [isOpen, menuRef, pendingFocus]);

  if (!isOpen) return null;

  const handleKeyDown = (event) => {
    const items = Array.from(menuRef.current?.querySelectorAll(itemSelector) || []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement);

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        items[(index + 1) % items.length].focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        items[(index - 1 + items.length) % items.length].focus();
        break;
      case "Home":
        event.preventDefault();
        items[0].focus();
        break;
      case "End":
        event.preventDefault();
        items[items.length - 1].focus();
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case "Tab":
        // Let focus leave naturally, but don't strand an open menu.
        close(false);
        break;
      default:
        break;
    }
  };

  const alignmentClass = align === "end" ? "right-0" : "left-0";

  return (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`absolute ${alignmentClass} mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50`}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ children, onClick }) {
  const { close } = useContext(DropdownMenuContext);

  const handleClick = () => {
    onClick?.();
    close();
  };

  return (
    <button
      type="button"
      role="menuitem"
      // Roving focus: items are reachable by arrow keys, not by Tab, so the
      // menu counts as one tab stop.
      tabIndex={-1}
      onClick={handleClick}
      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none transition-colors"
    >
      {children}
    </button>
  );
}
