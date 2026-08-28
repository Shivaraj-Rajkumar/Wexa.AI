'use client';
import { useState, useRef, useEffect } from 'react';
import { Database, Server, ChevronDown } from 'lucide-react';

interface ComponentItem {
  name: string;
  type: string;
}

interface CustomDropdownProps {
  components: ComponentItem[];
  selected: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export default function CustomDropdown({ components, selected, onSelect, disabled }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItem = components.find(c => c.name === selected);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1 w-full" ref={dropdownRef}>
      <div 
        className={`w-full flex items-center justify-between border-slate-300 text-slate-900 rounded-xl shadow-sm p-4 border bg-slate-50 transition-all font-medium text-lg cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="flex items-center">
          {selectedItem 
            ? (
                <>
                  {selectedItem.type === 'Database' ? <Database className="h-5 w-5 mr-3 text-indigo-500" /> : <Server className="h-5 w-5 mr-3 text-indigo-500" />}
                  <span className="text-slate-500 mr-2">{selectedItem.type} :</span> 
                  {selectedItem.name}
                </>
              )
            : (<span className="text-slate-400">Choose a Service or Database...</span>)
          }
        </span>
        <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          <div className="py-2">
            {components.map((c, i) => (
              <div 
                key={c.name}
                className={`px-4 py-3 cursor-pointer transition-colors flex items-center ${selected === c.name ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                onClick={() => {
                  onSelect(c.name);
                  setIsOpen(false);
                }}
              >
                <div className="mr-3">
                   {c.type === 'Database' ? <Database className={`h-4 w-4 ${selected === c.name ? 'text-indigo-600' : 'text-slate-400'}`} /> : <Server className={`h-4 w-4 ${selected === c.name ? 'text-indigo-600' : 'text-slate-400'}`} />}
                </div>
                <span className="font-semibold text-slate-500 mr-2">{c.type} :</span>
                <span>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
