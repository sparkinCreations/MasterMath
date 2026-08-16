import * as React from "react"
import { cn } from "@/lib/utils"

// An accessible single-select built on the ARIA combobox + listbox pattern.
//
// Focus deliberately stays on the trigger while the list is open, and the
// active option is tracked with aria-activedescendant. That avoids moving
// focus into a popup (and having to trap/restore it) while still giving
// keyboard users arrow-key navigation, Enter/Space to choose, and Escape
// to dismiss.
//
// Composition is assumed to be Select > (SelectTrigger, SelectContent >
// SelectItem...), which is how every call site uses it; the option list is
// read straight off that tree so navigation needs no registration effects.

const SelectContext = React.createContext({
  isOpen: false,
  setIsOpen: () => {},
  value: "",
  onValueChange: () => {},
  activeIndex: -1,
  listboxId: "",
  triggerId: "",
  optionId: () => "",
})

// Pull the ordered option values out of the children tree.
const collectItemValues = (children) => {
  const values = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === SelectContent) {
      React.Children.forEach(child.props.children, (item) => {
        if (React.isValidElement(item) && item.type === SelectItem) {
          values.push(item.props.value)
        }
      })
    }
  })
  return values
}

// `id` names the trigger button, so a page-level <Label htmlFor> can point at
// a real element. It falls back to a generated id when the caller omits it.
const Select = ({ children, value, onValueChange, id }) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const reactId = React.useId()

  const itemValues = collectItemValues(children)
  const optionId = React.useCallback((index) => `${reactId}-option-${index}`, [reactId])
  const listboxId = `${reactId}-listbox`
  const triggerId = id || `${reactId}-trigger`

  const open = (index) => {
    const selected = itemValues.indexOf(value)
    setActiveIndex(index !== undefined ? index : selected >= 0 ? selected : 0)
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
    setActiveIndex(-1)
  }

  const commit = (index) => {
    if (index >= 0 && index < itemValues.length) onValueChange(itemValues[index])
    close()
  }

  const handleKeyDown = (event) => {
    const last = itemValues.length - 1
    if (last < 0) return

    if (!isOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault()
        open()
      }
      return
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, last))
        break
      case "ArrowUp":
        event.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        break
      case "Home":
        event.preventDefault()
        setActiveIndex(0)
        break
      case "End":
        event.preventDefault()
        setActiveIndex(last)
        break
      case "Enter":
      case " ":
        event.preventDefault()
        commit(activeIndex)
        break
      case "Escape":
        event.preventDefault()
        close()
        break
      case "Tab":
        // Let focus move on, but don't leave an orphaned popup behind.
        close()
        break
      default:
        break
    }
  }

  return (
    <SelectContext.Provider
      value={{
        isOpen,
        setIsOpen: (next) => (next ? open() : close()),
        value,
        onValueChange,
        activeIndex,
        setActiveIndex,
        listboxId,
        triggerId,
        optionId,
      }}
    >
      <div className="relative" onKeyDown={handleKeyDown}>
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { isOpen, setIsOpen, activeIndex, listboxId, triggerId, optionId } =
    React.useContext(SelectContext)

  // aria-controls points at the listbox only while it is open — the popup is
  // unmounted when collapsed, and a dangling reference is worse than none.
  return (
    <button
      ref={ref}
      type="button"
      id={triggerId}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls={isOpen ? listboxId : undefined}
      aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <svg
        className="h-4 w-4 opacity-50"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fillRule="evenodd"
          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder, children }) => {
  const { value } = React.useContext(SelectContext)
  // If children are provided, use them; otherwise fall back to value or placeholder
  return <span className="block truncate">{children || value || placeholder}</span>
}

const SelectContent = ({ children }) => {
  const {
    isOpen,
    setIsOpen,
    value,
    onValueChange,
    activeIndex,
    setActiveIndex,
    listboxId,
    triggerId,
    optionId,
  } = React.useContext(SelectContext)

  if (!isOpen) return null

  let index = -1

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
      <div
        id={listboxId}
        role="listbox"
        aria-labelledby={triggerId}
        className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-white/10 focus:outline-none sm:text-sm"
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.type === SelectItem) {
            index += 1
            const itemIndex = index
            return React.cloneElement(child, {
              id: optionId(itemIndex),
              onSelect: (itemValue) => {
                onValueChange(itemValue)
                setIsOpen(false)
              },
              onHover: () => setActiveIndex(itemIndex),
              isSelected: value === child.props.value,
              isActive: activeIndex === itemIndex,
            })
          }
          return child
        })}
      </div>
    </>
  )
}

const SelectItem = React.forwardRef(
  ({ className, children, value, onSelect, onHover, isSelected, isActive, ...props }, ref) => {
    const innerRef = React.useRef(null)

    // Keep the keyboard-active option in view when arrowing through a long list.
    React.useEffect(() => {
      if (isActive && innerRef.current) {
        innerRef.current.scrollIntoView({ block: "nearest" })
      }
    }, [isActive])

    return (
      <div
        ref={(node) => {
          innerRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        role="option"
        aria-selected={!!isSelected}
        className={cn(
          "relative cursor-pointer select-none py-2 pl-3 pr-9",
          isActive && "bg-gray-100 dark:bg-gray-700",
          isSelected && "bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-200 font-semibold",
          className
        )}
        onClick={() => onSelect && onSelect(value)}
        onMouseMove={() => onHover && onHover()}
        {...props}
      >
        {children}
      </div>
    )
  }
)
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
