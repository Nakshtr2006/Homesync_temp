async function api(path, options) {
  const opts = options || {};
  const response = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
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

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("homesyncUser") || "null");
  } catch (err) {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem("homesyncUser", JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
  }));
}

function clearUser() {
  localStorage.removeItem("homesyncUser");
}
