function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    // 1. Explicit production runtime configuration (from config.js or inline window object)
    var configuredUrl = window.__HOMESYNC_API_URL__ || window.HOMESYNC_API_URL;
    if (configuredUrl && typeof configuredUrl === "string" && configuredUrl.trim() !== "") {
      return configuredUrl.trim().replace(/\/+$/, "");
    }

    // 2. Local storage override (allows dynamic testing or switching backend URLs)
    try {
      var storedUrl = localStorage.getItem("homesync_api_url");
      if (storedUrl && typeof storedUrl === "string" && storedUrl.trim() !== "") {
        return storedUrl.trim().replace(/\/+$/, "");
      }
    } catch (e) {}

    // 3. Localhost / Local Development environments
    if (window.location) {
      var hostname = window.location.hostname;
      var protocol = window.location.protocol;
      var port = window.location.port;

      // When opened via file:// protocol
      if (protocol === "file:") {
        return "http://localhost:3000";
      }

      // When running on localhost or 127.0.0.1
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        // When served directly by the Express backend on port 3000
        if (port === "3000") {
          return "";
        }
        // When running under Live Server (5500/5501) or other dev ports, redirect to backend
        return "http://localhost:3000";
      }
    }
  }

  // 4. Default for production relative paths (e.g. Vercel domain or reverse proxy)
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
