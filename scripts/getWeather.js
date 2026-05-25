/**
 * Obtiene el clima y la ubicación basada en la IP
 */
async function fetchInfo() {
    try {
        // 1. Obtener ubicación por IP (usando ipapi.co - gratis para pruebas)
        const locRes = await fetch('https://ipapi.co/json/');
        const locData = await locRes.json();
        
        const { city, country_name, latitude, longitude } = locData;

        // 2. Obtener clima simplificado (usando wttr.in con formato JSON)
        // Usamos la ciudad obtenida de la IP
        const weatherRes = await fetch(`https://wttr.in/${city}?format=j1`);
        const weatherData = await weatherRes.json();
        
        const current = weatherData.current_condition[0];
        const temp = current.temp_C;
        const desc = current.lang_es ? current.lang_es[0].value : current.weatherDesc[0].value;

        console.log(`📍 Ubicación detectada: ${city}, ${country_name}`);
        console.log(`🌐 Coordenadas: ${latitude}, ${longitude}`);
        console.log(`🌡️  Temperatura actual: ${temp}°C`);
        console.log(`☁️  Estado: ${desc}`);
        console.log(`⏰ Hora local: ${new Date().toLocaleTimeString()}`);
        
    } catch (err) {
        console.log("Error al obtener datos en tiempo real: " + err.message);
        // Fallback simple si falla la API
        console.log("No se pudo conectar con los servicios de clima.");
    }
}

fetchInfo();
