import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// The Supabase client throws at import time without these, and every module that
// touches the API pulls it in transitively.
vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("VITE_API_URL", "http://localhost:8000");
