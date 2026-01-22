/**
 * Cliente HTTP centralizado con manejo de errores y headers automáticos
 */

import { ApiError } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getTelegramUserId(): string {
    const id = localStorage.getItem("telegram_user_id");
    return id || "0";
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const url = new URL(endpoint, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    return url.toString();
  }

  private getHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      "X-Telegram-UserId": this.getTelegramUserId(),
    };
  }

  private handleError(response: Response, data: unknown): never {
    const error = data as ApiError;
    const message = error.detail || error.message || `HTTP ${response.status}`;
    const err = new Error(typeof message === "string" ? message : JSON.stringify(message));
    (err as any).status = response.status;
    throw err;
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...this.getHeaders(),
          ...(fetchOptions.headers || {}),
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        this.handleError(response, data);
      }

      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Unknown error occurred");
    }
  }

  get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "GET",
    });
  }

  post<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
