var rooms = [];
var devices = [];
var editingDeviceId = null;

var pageHeadings = {
  dashboard: {
    eyebrow: "Good morning,",
    heading: "Welcome back to HomeSync",
    subheading: "Control and monitor your connected home devices from one place."
  },
  rooms: {
    eyebrow: "Your home,",
    heading: "Rooms",
    subheading: "See every room in your home and what's connected inside it."
  },
  devices: {
    eyebrow: "Everything connected,",
    heading: "Devices",
    subheading: "Turn devices on or off and check how much energy they use."
  }
};

function showPage(targetPage) {
  document.querySelectorAll(".nav-item").forEach(function (item) {
    item.classList.toggle("active", item.getAttribute("data-page") === targetPage);
  });

  document.querySelectorAll(".page-section").forEach(function (section) {
    section.classList.remove("active");
  });
  document.getElementById("page-" + targetPage).classList.add("active");

  document.getElementById("right-panel").style.display = targetPage === "dashboard" ? "flex" : "none";
  document.getElementById("page-eyebrow").textContent = pageHeadings[targetPage].eyebrow;
  document.getElementById("page-heading").textContent = pageHeadings[targetPage].heading;
  document.getElementById("page-subheading").textContent = pageHeadings[targetPage].subheading;
}

function showAccount() {
  var user = getUser();
  var name = user ? user.name : "Guest";
  document.getElementById("profile-name").textContent = name;
  var accountLink = document.getElementById("account-link");
  accountLink.textContent = user ? "Log out" : "Login";
}

function iconFor(type) {
  var value = (type || "").toLowerCase();
  if (value.indexOf("light") !== -1 || value.indexOf("lamp") !== -1) return ["💡", "green-icon"];
  if (value.indexOf("tv") !== -1) return ["🖥", "green-icon"];
  if (value.indexOf("heat") !== -1) return ["🔥", "orange-icon"];
  if (value.indexOf("ac") !== -1 || value.indexOf("cool") !== -1) return ["❄", "blue-icon"];
  if (value.indexOf("wifi") !== -1 || value.indexOf("speaker") !== -1) return ["📶", "purple-icon"];
  return ["⌂", "green-icon"];
}

function deviceCard(device) {
  var icon = iconFor(device.type);
  var card = document.createElement("div");
  card.className = "device-card";
  card.innerHTML =
    '<div class="device-icon ' + icon[1] + '">' + icon[0] + "</div>" +
    '<div class="device-info">' +
      '<div class="device-name"></div>' +
      '<div class="device-status"><span class="status-dot' + (device.isOn ? " on-dot" : "") + '"></span> ' +
        (device.isOn ? "Online" : "Offline") + "</div>" +
      '<div class="device-usage"></div>' +
    "</div>" +
    '<div class="device-controls">' +
      '<label class="toggle-switch" title="Toggle power"><input type="checkbox"' + (device.isOn ? " checked" : "") + '><span class="toggle-slider"></span></label>' +
      '<div class="device-btn-group">' +
        '<button type="button" class="icon-btn edit-device" title="Edit device">Edit</button>' +
        '<button type="button" class="icon-btn delete-device" title="Delete device">Delete</button>' +
      '</div>' +
    "</div>";

  card.querySelector(".device-name").textContent = device.name;
  card.querySelector(".device-usage").textContent = device.room + " · " + device.type;

  card.querySelector("input").addEventListener("change", function (event) {
    toggleDevice(device.id, event.target.checked);
  });
  card.querySelector(".edit-device").addEventListener("click", function () {
    startDeviceEdit(device);
  });
  card.querySelector(".delete-device").addEventListener("click", function () {
    removeDevice(device.id);
  });

  return card;
}

function renderDevices() {
  var dashboard = document.getElementById("dashboard-devices");
  var all = document.getElementById("all-devices");
  dashboard.innerHTML = "";
  all.innerHTML = "";

  if (!devices.length) {
    dashboard.innerHTML = '<p class="empty-note">No devices yet. Add one from the Devices page.</p>';
    all.innerHTML = '<p class="empty-note">No devices yet.</p>';
  }

  devices.forEach(function (device, index) {
    all.appendChild(deviceCard(device));
    if (index < 4) dashboard.appendChild(deviceCard(device));
  });

  var switchedOn = devices.filter(function (device) { return device.isOn; }).length;
  document.getElementById("energy-value").textContent = switchedOn;
  document.getElementById("energy-note").textContent = "of " + devices.length + " devices switched on";
}

function roomIcons() {
  return [
    ["🛋", "green-icon"],
    ["🛏", "blue-icon"],
    ["🍳", "orange-icon"],
    ["🚿", "purple-icon"]
  ];
}

function renderRooms() {
  var grid = document.getElementById("room-grid");
  var select = document.getElementById("device-room");
  grid.innerHTML = "";
  select.innerHTML = "";

  if (!rooms.length) {
    grid.innerHTML = '<p class="empty-note">No rooms yet. Add one above.</p>';
  }

  rooms.forEach(function (room, index) {
    var icon = roomIcons()[index % 4];
    var card = document.createElement("div");
    card.className = "room-card";
    card.innerHTML =
      '<div class="room-icon ' + icon[1] + '">' + icon[0] + "</div>" +
      '<div class="room-name"></div>' +
      '<div class="room-meta"></div>' +
      '<div class="room-actions">' +
        '<button type="button" class="icon-btn rename-room">Rename</button>' +
        '<button type="button" class="icon-btn delete-room">Delete</button>' +
      "</div>";
    card.querySelector(".room-name").textContent = room.name;
    card.querySelector(".room-meta").textContent = room.deviceCount + (room.deviceCount === 1 ? " device" : " devices");
    card.querySelector(".rename-room").addEventListener("click", function () {
      renameRoom(room);
    });
    card.querySelector(".delete-room").addEventListener("click", function () {
      removeRoom(room.id);
    });
    grid.appendChild(card);

    var option = document.createElement("option");
    option.value = room.name;
    option.textContent = room.name;
    select.appendChild(option);
  });
}

function setFormError(id, message) {
  document.getElementById(id).textContent = message || "";
}

async function loadHome() {
  try {
    rooms = await api("/api/rooms");
    devices = await api("/api/devices");
    setFormError("home-error", "");
    renderRooms();
    renderDevices();
  } catch (err) {
    setFormError("home-error", err.message);
  }
}

async function toggleDevice(id, isOn) {
  try {
    await api("/api/devices/" + id, { method: "PATCH", body: { isOn: isOn } });
    await loadHome();
  } catch (err) {
    setFormError("device-form-error", err.message);
    await loadHome();
  }
}

function startDeviceEdit(device) {
  editingDeviceId = device.id;
  document.getElementById("device-name").value = device.name;
  document.getElementById("device-type").value = device.type;
  document.getElementById("device-room").value = device.room;
  document.getElementById("device-submit").textContent = "Save changes";
  document.getElementById("device-cancel").hidden = false;
  showPage("devices");
}

function clearDeviceForm() {
  editingDeviceId = null;
  document.getElementById("device-form").reset();
  document.getElementById("device-submit").textContent = "Add device";
  document.getElementById("device-cancel").hidden = true;
  setFormError("device-form-error", "");
}

async function removeDevice(id) {
  if (!confirm("Remove this device?")) return;
  try {
    await api("/api/devices/" + id, { method: "DELETE" });
    if (editingDeviceId === id) clearDeviceForm();
    await loadHome();
  } catch (err) {
    setFormError("device-form-error", err.message);
  }
}

async function renameRoom(room) {
  var name = prompt("New room name", room.name);
  if (!name || !name.trim() || name.trim() === room.name) return;
  try {
    await api("/api/rooms/" + room.id, { method: "PATCH", body: { name: name.trim() } });
    await loadHome();
  } catch (err) {
    setFormError("room-form-error", err.message);
  }
}

async function removeRoom(id) {
  if (!confirm("Remove this room? Devices in it will stay, but they will no longer match a room.")) return;
  try {
    await api("/api/rooms/" + id, { method: "DELETE" });
    await loadHome();
  } catch (err) {
    setFormError("room-form-error", err.message);
  }
}

function weatherLabel(code) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  return "Storm";
}

function displayTemp(celsius) {
  var unit = localStorage.getItem("unit") || "C";
  if (unit === "F") return Math.round((celsius * 9) / 5 + 32) + "°F";
  return Math.round(celsius) + "°C";
}

async function loadWeather(city) {
  var label = document.getElementById("weather-label");
  label.textContent = "Looking up " + city + "...";

  try {
    // Primary: Call the Express backend API which fetches from Open-Meteo external service
    var data = await api("/api/weather?city=" + encodeURIComponent(city));
    document.getElementById("weather-temp").textContent = displayTemp(data.temperature);
    label.textContent = data.condition + " in " + data.city;
    localStorage.setItem("weatherCity", city);
  } catch (err) {
    // Fallback: If backend is unreachable, perform direct browser fetch to Open-Meteo
    try {
      var geoResponse = await fetch(
        "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(city)
      );
      var geo = await geoResponse.json();
      if (!geo.results || !geo.results.length) {
        label.textContent = "City not found";
        return;
      }

      var place = geo.results[0];
      var weatherResponse = await fetch(
        "https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code&latitude=" +
          place.latitude + "&longitude=" + place.longitude
      );
      var weather = await weatherResponse.json();
      document.getElementById("weather-temp").textContent = displayTemp(weather.current.temperature_2m);
      label.textContent = weatherLabel(weather.current.weather_code) + " in " + place.name;
      localStorage.setItem("weatherCity", city);
    } catch (fallbackErr) {
      label.textContent = err.message || "Weather is unavailable right now";
    }
  }
}

document.querySelectorAll(".nav-item").forEach(function (link) {
  link.addEventListener("click", function (event) {
    var targetPage = link.getAttribute("data-page");
    if (!targetPage) return;
    event.preventDefault();
    showPage(targetPage);
  });
});

document.getElementById("view-all-devices").addEventListener("click", function (event) {
  event.preventDefault();
  showPage("devices");
});

document.getElementById("account-link").addEventListener("click", function (event) {
  if (!getUser()) return;
  event.preventDefault();
  clearUser();
  showAccount();
});

document.getElementById("room-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  var name = document.getElementById("room-name").value;
  setFormError("room-form-error", "");
  try {
    await api("/api/rooms", { method: "POST", body: { name: name } });
    event.target.reset();
    await loadHome();
  } catch (err) {
    setFormError("room-form-error", err.message);
  }
});

document.getElementById("device-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  if (!rooms.length) {
    setFormError("device-form-error", "Add a room before adding a device.");
    return;
  }

  var body = {
    name: document.getElementById("device-name").value,
    room: document.getElementById("device-room").value,
    type: document.getElementById("device-type").value
  };
  setFormError("device-form-error", "");

  try {
    if (editingDeviceId) {
      await api("/api/devices/" + editingDeviceId, { method: "PATCH", body: body });
    } else {
      await api("/api/devices", { method: "POST", body: body });
    }
    clearDeviceForm();
    await loadHome();
  } catch (err) {
    setFormError("device-form-error", err.message);
  }
});

document.getElementById("device-cancel").addEventListener("click", clearDeviceForm);

document.getElementById("weather-form").addEventListener("submit", function (event) {
  event.preventDefault();
  var city = document.getElementById("weather-city").value.trim();
  if (city) loadWeather(city);
});

document.body.classList.toggle("dark", localStorage.getItem("dark") === "true");
showAccount();

var startPage = (location.hash || "#dashboard").replace("#", "");
if (pageHeadings[startPage]) showPage(startPage);

document.getElementById("weather-city").value = localStorage.getItem("weatherCity") || "Delhi";
loadWeather(document.getElementById("weather-city").value);
loadHome();
