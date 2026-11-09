import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";

import type { PropsWithChildren } from "react";

import {
  getStoredUser,
  login as apiLogin,
  logout as apiLogout
} from "../services/api";

import type { LoginDetails, User } from "../types/models";

interface AuthContextValue {
  user: User | null;
  signIn: (credentials: LoginDetails) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);

export function AuthProvider({
  children
}: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(
    () => getStoredUser()
  );

  const signIn = useCallback(
    async (credentials: LoginDetails): Promise<User> => {
      const signedInUser = await apiLogin(credentials);
      setUser(signedInUser);
      return signedInUser;
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    await apiLogout();
    setUser(getStoredUser());
  }, []);

  const value = useMemo(
    () => ({ user, signIn, signOut }),
    [user, signIn, signOut]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}