import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_home():
    """Test the home page endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert "Kundenstandorte Visualisierung" in response.text

def test_geocode():
    """Test geocoding endpoint"""
    payload = [{"kundennummer": "123", "adresse": "Planegg, Deutschland"}]
    
    response = client.post("/geocode", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert "results" in data
    assert len(data["results"]) == 1
    
    result = data["results"][0]
    assert result["kundennummer"] == "123"
    assert "lat" in result
    assert "lon" in result

def test_geocode_multiple():
    """Test geocoding multiple addresses"""
    payload = [
        {"kundennummer": "123", "adresse": "Münchener Straße 15, 85652 Pliening, Deutschland"},
        {"kundennummer": "456", "adresse": "Robert-Koch-Straße 2, 82152 Planegg, Deutschland"}
    ]
    response = client.post("/geocode", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) == 2

def test_geocode_empty_address():
    """Test geocoding with empty address"""
    payload = [{"kundennummer": "123", "adresse": ""}]
    response = client.post("/geocode", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["results"][0]["error"] == "Keine Adresse angegeben"

def test_optimize_route():
    """Test route optimization endpoint"""
    payload = {
        "locations": [
            {"kundennummer": "123", "adresse": "Planegg, Deutschland"},
            {"kundennummer": "456", "adresse": "München, Deutschland"}
        ],
        "force_return_to_hq": True
    }
    response = client.post("/optimize-route", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "tours" in data
    assert isinstance(data["tours"], list)

def test_optimize_route_with_coordinates():
    """Test route optimization with pre-provided coordinates"""
    payload = {
        "locations": [
            {
                "kundennummer": "123", 
                "adresse": "Test Address",
                "lat": 48.1754529,
                "lon": 11.8247652
            }
        ]
    }
    response = client.post("/optimize-route", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "tours" in data

def test_optimize_route_empty_locations():
    """Test route optimization with empty locations"""
    payload = {"locations": []}
    response = client.post("/optimize-route", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert "error" in data

def test_manual_entry():
    """Test manual customer entry"""
    payload = [{"kundennummer": "123", "adresse": "Test Address"}]
    response = client.post("/manual-entry", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Customers added successfully"

def test_import_csv_endpoint():
    """Test CSV import endpoint exists"""
    # This is a basic test - actual file upload testing would require more complex setup
    response = client.post("/import-csv")
    # Should return 422 (validation error) for missing file, not 404
    assert response.status_code in [422, 400]

def test_export_kml():
    """Test KML export endpoint"""
    payload = [
        {
            "kundennummer": "123",
            "adresse": "Test Address",
            "lat": 48.1754529,
            "lon": 11.8247652,
            "priority": 1,
            "bottles": 10,
            "is_depot": False
        }
    ]
    response = client.post("/export-kml", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.google-earth.kml+xml"
    assert "kundenstandorte.kml" in response.headers["content-disposition"]

if __name__ == "__main__":
    pytest.main([__file__])
