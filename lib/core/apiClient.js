export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const requestError = new Error(data?.error ?? `API request failed (${response.status})`);
    requestError.status = response.status;
    requestError.data = data;
    throw requestError;
  }
  return data;
}
