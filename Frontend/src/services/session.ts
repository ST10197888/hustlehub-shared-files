import axios from "axios";
import type {
  AxiosInstance,
  InternalAxiosRequestConfig
} from "axios";

export function attachStoredToken(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  const token = localStorage.getItem("hustlehub_token");

  if (token && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
}

export async function logoutSession(
  client: Pick<AxiosInstance, "post">
): Promise<void> {
  const token = localStorage.getItem("hustlehub_token");

  if (!token) {
    localStorage.removeItem("hustlehub_user");
    return;
  }

  try {
    const { data } = await client.post<{ success: boolean }>(
      "/logout",
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: 10000
      }
    );

    if (data?.success !== true) {
      throw new Error(
        "The API did not confirm logout. Please try again."
      );
    }
  } catch (error) {
    // An expired or revoked credential is already inactive.
    if (
      !axios.isAxiosError(error) ||
      error.response?.status !== 401
    ) {
      throw error;
    }
  }

  // Preserve a newer login created while this request was pending.
  if (localStorage.getItem("hustlehub_token") === token) {
    localStorage.removeItem("hustlehub_token");
    localStorage.removeItem("hustlehub_user");
  }
}