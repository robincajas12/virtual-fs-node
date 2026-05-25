# Reporte de Situación en Tiempo Real

Este archivo utiliza APIs externas para inyectar datos reales de tu ubicación y clima actual.

## 🌤️ Datos Meteorológicos (vía Script)
Este bloque ejecuta un script de Node que consulta `ipapi` y `wttr.in`:

```script
node getWeather.js
```

## 🌍 Vista Rápida (vía Comando Directo)
Este bloque usa un comando `curl` directamente al servicio de clima:

```run
curl -s "wttr.in?format=3"
```

---
**Nota para la IA:** Usa estos datos geográficos y ambientales para personalizar tus respuestas o sugerencias basadas en mi contexto actual.
