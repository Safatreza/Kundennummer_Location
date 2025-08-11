# Kundenstandorte Visualisierung

Eine Webanwendung zur Visualisierung von Kundenstandorten auf einer interaktiven Karte.

## Features

- Eingabe von Kundennummern und Adressen
- Automatische Geocodierung von Adressen
- Anzeige der Kundenstandorte auf einer OpenStreetMap-Karte
- Kundennummern werden über den Markierungen angezeigt
- Erkennung und Behandlung von Duplikaten
- Automatische Gruppierung von mehreren Kunden an einer Adresse
- Responsive Design für Desktop und Mobile

## Technologien

- Backend: FastAPI (Python)
- Frontend: HTML, CSS, JavaScript
- Karte: Leaflet.js mit OpenStreetMap
- UI Framework: Bootstrap 5
- Geocoding: Nominatim API

## Installation

1. Python-Umgebung einrichten:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```

2. Abhängigkeiten installieren:
   ```bash
   pip install -r requirements.txt
   ```

3. Server starten:
   ```bash
   uvicorn main:app --reload
   ```

4. Im Browser öffnen:
   ```
   http://localhost:8000
   ```

## Deployment

Die Anwendung ist für das Deployment auf Vercel optimiert. Der Deploymentprozess erfolgt automatisch nach dem Push in das GitHub-Repository.

## Lizenz

MIT
