from typing import List
from fastapi.responses import Response
from pydantic import BaseModel

class LocationData(BaseModel):
    kundennummer: str
    adresse: str
    lat: float
    lon: float
    priority: int = 0
    bottles: int = 0
    is_depot: bool = False

def generate_kml(locations: List[LocationData]) -> str:
    """Generate KML file content from location data."""
    kml_content = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        '<Document>',
        '<name>Kundenstandorte</name>',
        '<description>Exportierte Kundenstandorte für Google Maps</description>',
        # Style for regular customers
        '<Style id="customerStyle">',
        '  <IconStyle>',
        '    <color>ff0000ff</color>',
        '    <scale>1.0</scale>',
        '    <Icon>',
        '      <href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href>',
        '    </Icon>',
        '  </IconStyle>',
        '</Style>',
        # Style for priority customers
        '<Style id="priorityStyle">',
        '  <IconStyle>',
        '    <color>ff00ffff</color>',
        '    <scale>1.2</scale>',
        '    <Icon>',
        '      <href>http://maps.google.com/mapfiles/kml/paddle/orange-circle.png</href>',
        '    </Icon>',
        '  </IconStyle>',
        '</Style>',
        # Style for depots
        '<Style id="depotStyle">',
        '  <IconStyle>',
        '    <color>ff0000ff</color>',
        '    <scale>1.5</scale>',
        '    <Icon>',
        '      <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>',
        '    </Icon>',
        '  </IconStyle>',
        '</Style>'
    ]

    # Add placemarks for each location
    for location in locations:
        style_id = "depotStyle" if location.is_depot else "priorityStyle" if location.priority > 0 else "customerStyle"
        description = f"Kundennummer: {location.kundennummer}<br/>"
        description += f"Adresse: {location.adresse}<br/>"
        if location.bottles:
            description += f"Flaschen: {location.bottles}<br/>"
        if location.priority:
            description += f"Priorität: {location.priority}<br/>"
        if location.is_depot:
            description += "Depot<br/>"

        kml_content.extend([
            '<Placemark>',
            f'  <name>{location.kundennummer}</name>',
            f'  <description><![CDATA[{description}]]></description>',
            f'  <styleUrl>#{style_id}</styleUrl>',
            '  <Point>',
            f'    <coordinates>{location.lon},{location.lat},0</coordinates>',
            '  </Point>',
            '</Placemark>'
        ])

    kml_content.extend(['</Document>', '</kml>'])
    return '\n'.join(kml_content)

def create_kml_response(locations: List[LocationData]) -> Response:
    """Create a downloadable KML file response."""
    kml_content = generate_kml(locations)
    return Response(
        content=kml_content,
        media_type="application/vnd.google-earth.kml+xml",
        headers={
            "Content-Disposition": "attachment; filename=kundenstandorte.kml"
        }
    )
