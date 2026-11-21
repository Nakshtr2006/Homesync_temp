function weatherLabel(code) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  return "Storm";
}

// GET /api/weather?city=Delhi
async function getWeather(req, res, next) {
  try {
    const rawCity =
      typeof req.query.city === "string"
        ? req.query.city
        : req.query.city
        ? String(req.query.city)
        : "Delhi";
    const city = rawCity.trim();

    if (!city) {
      return res.status(400).json({ error: "City name cannot be empty" });
    }

    // Call external Open-Meteo geocoding API
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(
      city
    )}`;
    const geoResponse = await fetch(geoUrl);
    if (!geoResponse.ok) {
      return res.status(502).json({ error: "Failed to connect to geocoding service" });
    }

    const geoData = await geoResponse.json();
    if (!geoData.results || !geoData.results.length) {
      return res.status(404).json({ error: `City "${city}" not found` });
    }

    const place = geoData.results[0];
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code&latitude=${place.latitude}&longitude=${place.longitude}`;
    const forecastResponse = await fetch(forecastUrl);
    if (!forecastResponse.ok) {
      return res.status(502).json({ error: "Failed to connect to weather forecast service" });
    }

    const forecastData = await forecastResponse.json();
    if (!forecastData.current) {
      return res.status(502).json({ error: "Weather data format unrecognized" });
    }

    const weatherCode = forecastData.current.weather_code;
    const temperature = forecastData.current.temperature_2m;

    res.json({
      city: place.name,
      country: place.country || "",
      latitude: place.latitude,
      longitude: place.longitude,
      temperature,
      weatherCode,
      condition: weatherLabel(weatherCode),
    });
  } catch (err) {
    console.error("[ExternalWeatherAPI]", err.message);
    res.status(500).json({ error: "Internal server error fetching external weather data" });
  }
}

module.exports = {
  getWeather,
};
