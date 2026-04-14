export interface ParsedApiError {
  status?: number;
  code?: string;
  message: string;
}

type ApiErrorResponseData = {
  code?: string;
  message?: string;
  error?: string | { description?: string };
};

type ApiLikeError = {
  response?: {
    status?: number;
    data?: ApiErrorResponseData;
  };
  message?: string;
};

export const parseApiError = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): ParsedApiError => {
  const e = (error || {}) as ApiLikeError;
  const status = e.response?.status;
  const data = e.response?.data || {};
  const code = data?.code;
  const message =
    data?.message ||
    (typeof data?.error === "object" ? data.error?.description : undefined) ||
    (typeof data?.error === "string" ? data.error : undefined) ||
    e?.message ||
    fallback;

  return { status, code, message };
};
