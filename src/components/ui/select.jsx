import * as React from "react"
import { cn } from "@/lib/utils"

const SelectContext = React.createContext({ isOpen: false, setIsOpen: () => {}, value: "", onValueChange: () => {} })

const Select = ({ children, value, onValueChange }) => {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <SelectContext.Provider value={{ isOpen, setIsOpen, value, onValueChange }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { isOpen, setIsOpen, value } = React.useContext(SelectContext)

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
  const { isOpen, setIsOpen, value, onValueChange } = React.useContext(SelectContext)

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => setIsOpen(false)}
      />
      <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
        {React.Children.map(children, child => {
          if (child.type === SelectItem) {
            return React.cloneElement(child, {
              onSelect: (itemValue) => {
                onValueChange(itemValue)
                setIsOpen(false)
              },
              isSelected: value === child.props.value
            })
          }
          return child
        })}
      </div>
    </>
  )
}

const SelectItem = React.forwardRef(({ className, children, value, onSelect, isSelected, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-gray-100",
      isSelected && "bg-purple-100 font-semibold",
      className
    )}
    onClick={() => onSelect && onSelect(value)}
    {...props}
  >
    {children}
  </div>
))
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
