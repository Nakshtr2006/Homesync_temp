function getApiBaseUrl() {
  if (typeof window !== "undefined" && window.location) {
    const protocol = window.location.protocol;
    const port = window.location.port;
    // When served directly by the Express server on port 3000
    if ((protocol === "http:" || protocol === "https:") && (port === "3000" || port === "")) {
      return "";
    }
    // When running under Live Server (port 5500/5501) or other dev ports, redirect to backend
    if (protocol === "http:" || protocol === "https:") {
      return "http://localhost:3000";
    }
    // When opened via file:// protocol
    if (protocol === "file:") {
      return "http://localhost:3000";
    }
  }
  return "";
}

function getToken() {
  return localStorage.getItem("homesyncToken") || "";
}

function setToken(token) {
  if (token) {
    localStorage.setItem("homesyncToken", token);
  } else {
    localStorage.removeItem("homesyncToken");
  }
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("homesyncUser") || "null");
  } catch (err) {
    return null;
  }
}

function setUser(user) {
  if (!user) {
    clearUser();
    return;
  }
  if (user.token) {
    setToken(user.token);
  }
  localStorage.setItem(
    "homesyncUser",
    JSON.stringify({
      id: user.id || user._id,
      name: user.name,
      email: user.email,
      preferences: user.preferences || {},
    })
  );
}

function clearUser() {
  localStorage.removeItem("homesyncUser");
  localStorage.removeItem("homesyncToken");
}

async function api(path, options) {
  const opts = options || {};
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {}
  );

  const token = getToken();
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = "Bearer " + token;
  }

  const baseUrl = getApiBaseUrl();
  const fullUrl = path.startsWith("http") ? path : (baseUrl + path);

  const response = await fetch(fullUrl, {
    method: opts.method || "GET",
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(function () {
    return {};
  });

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}
