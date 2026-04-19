import { cookies } from 'next/headers';

export interface AuthState {
  token: string | null;
}

export async function useAuth(): Promise<AuthState> {
  try {
    const store = await cookies();
    return { token: store.get('auth-token')?.value ?? null };
  } catch {
    return { token: null };
  }
}
