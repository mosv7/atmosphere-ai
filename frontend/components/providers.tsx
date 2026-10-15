"use client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api, citySchema, defaultCity, type City } from "@/lib/api";
type Context = {
  city: City;
  selectCity: (city: City) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
};
const EnvironmentContext = createContext<Context | null>(null);
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 120000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const [city, setCity] = useState<City>(defaultCity);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const selectCity = useCallback((next: City) => {
    setCity(next);
    localStorage.setItem("atmosphere-city", JSON.stringify(next));
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("atmosphere-theme", next);
  };
  return (
    <QueryClientProvider client={client}>
      <EnvironmentContext.Provider
        value={{ city, selectCity, theme, toggleTheme }}
      >
        <RestorePreferences onCity={setCity} onTheme={setTheme} />
        {children}
      </EnvironmentContext.Provider>
    </QueryClientProvider>
  );
}
function RestorePreferences({
  onCity,
  onTheme,
}: {
  onCity: (city: City) => void;
  onTheme: (theme: "dark" | "light") => void;
}) {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("atmosphere-city");
      if (saved) {
        const parsed = citySchema.safeParse(JSON.parse(saved));
        if (parsed.success) onCity(parsed.data);
      }
      const theme = localStorage.getItem("atmosphere-theme");
      if (theme === "light" || theme === "dark") {
        onTheme(theme);
        document.documentElement.dataset.theme = theme;
      }
    } catch {
      /* Invalid browser preferences are ignored. */
    }
  }, [onCity, onTheme]);
  return null;
}
export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (!context) throw new Error("Missing environment provider");
  return context;
}
export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: ({ signal }) => api<{ cities: City[] }>("cities", signal),
  });
}
