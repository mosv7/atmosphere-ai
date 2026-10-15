"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, MapPin, LoaderCircle } from "lucide-react";
import { api, type City } from "@/lib/api";
import { useEnvironment } from "./providers";
export function CitySearch({
  onSelect,
  placeholder = "Search a city...",
}: {
  onSelect?: (city: City) => void;
  placeholder?: string;
}) {
  const { selectCity } = useEnvironment();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [composing, setComposing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    if (composing) return;
    const timer = setTimeout(() => setDebounced(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text, composing]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const results = useQuery({
    queryKey: ["city-search", debounced],
    queryFn: ({ signal }) =>
      api<{ cities: City[] }>(
        `cities/search?q=${encodeURIComponent(debounced)}`,
        signal,
      ),
    enabled: debounced.length >= 2 && !composing,
  });
  const stale = debounced !== text.trim();
  const cities = stale ? [] : (results.data?.cities ?? []);
  const clear = () => {
    setText("");
    setDebounced("");
    setOpen(false);
    input.current?.focus();
  };
  const choose = (city: City) => {
    (onSelect ?? selectCity)(city);
    clear();
  };
  return (
    <div className="city-search" ref={root}>
      <Search size={18} />
      <input
        ref={input}
        role="combobox"
        aria-label="Search worldwide cities"
        aria-expanded={open && text.length >= 2}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={
          open && cities[active] ? `${id}-${active}` : undefined
        }
        value={text}
        placeholder={placeholder}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (composing || event.nativeEvent.isComposing) return;
          if (event.key === "Escape") setOpen(false);
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(0, cities.length - 1)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          }
          if (event.key === "Enter" && open && cities[active]) {
            event.preventDefault();
            choose(cities[active]);
          }
        }}
      />
      {text && (
        <button
          aria-label="Clear search"
          className="clear-search"
          onClick={clear}
        >
          <X size={16} />
        </button>
      )}
      {open && text.length >= 2 && (
        <div
          className="search-results"
          id={id}
          role="listbox"
          aria-label="City results"
        >
          {(results.isFetching || stale || composing) && (
            <p className="search-feedback">
              <LoaderCircle size={15} className="spin" /> Searching cities…
            </p>
          )}
          {!stale && results.error && (
            <div className="search-feedback" role="alert">
              Search temporarily unavailable.{" "}
              <button className="text-link" onClick={() => results.refetch()}>
                Retry search
              </button>
            </div>
          )}
          {!results.isFetching &&
            !results.error &&
            !stale &&
            debounced.length >= 2 &&
            cities.length === 0 && (
              <p className="search-feedback">
                No cities found. Try another spelling.
              </p>
            )}
          {cities.map((city, index) => (
            <button
              key={city.id}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              onClick={() => choose(city)}
              onPointerMove={() => setActive(index)}
            >
              <MapPin size={16} />
              <span>
                <strong>{city.name}</strong>
                <small>
                  {[city.administrative_region, city.country]
                    .filter(Boolean)
                    .join(", ")}
                </small>
              </span>
              <small>{city.timezone}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
