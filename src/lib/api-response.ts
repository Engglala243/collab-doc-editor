import { NextResponse } from "next/server";

export type ApiError = {
  error: string;
  message: string;
};

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: code ?? "error", message } satisfies ApiError,
    { status },
  );
}

export const errors = {
  unauthorized: () => apiError("Unauthorized", 401, "unauthorized"),
  forbidden: () => apiError("Forbidden", 403, "forbidden"),
  notFound: (resource = "Resource") =>
    apiError(`${resource} not found`, 404, "not_found"),
  badRequest: (msg: string) => apiError(msg, 400, "bad_request"),
  serverError: () => apiError("Internal server error", 500, "server_error"),
  tooManyRequests: (retryAfter = 60) =>
    NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    ),
  payloadTooLarge: (maxBytes: number) =>
    apiError(`Payload too large. Max allowed: ${Math.round(maxBytes / 1024)}KB`, 413, "payload_too_large"),
};

