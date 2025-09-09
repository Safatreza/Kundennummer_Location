"""
File processing service for Excel/CSV uploads
"""
import pandas as pd
import io
import logging
from typing import List, Dict, Any, Optional, Tuple
from fastapi import UploadFile, HTTPException

from app.models import Address, Priority
from app.services.address_manager import address_manager

logger = logging.getLogger(__name__)

class FileProcessor:
    """Service for processing uploaded Excel/CSV files"""
    
    SUPPORTED_FORMATS = ['.csv', '.xlsx', '.xls']
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_ADDRESSES = 200
    
    # Expected column names (case-insensitive)
    COLUMN_MAPPING = {
        'address': ['address', 'adresse', 'location', 'street', 'strasse'],
        'delivery_id': ['delivery_id', 'delivery_number', 'kundennummer', 'customer_id', 'id'],
        'bottles': ['bottles', 'bottle_count', 'flaschen', 'quantity', 'qty'],
        'priority': ['priority', 'priorität', 'prio', 'importance']
    }
    
    def __init__(self):
        self.validation_errors = []
        self.warnings = []
        
    async def process_upload(self, file: UploadFile) -> Dict[str, Any]:
        """
        Process uploaded Excel/CSV file and return results
        
        Args:
            file: Uploaded file from FastAPI
            
        Returns:
            Dictionary with processing results
        """
        self.validation_errors = []
        self.warnings = []
        
        try:
            # Validate file
            await self._validate_file(file)
            
            # Read file content
            content = await file.read()
            
            # Parse file based on extension
            df = await self._parse_file(content, file.filename)
            
            # Validate and process data
            addresses = await self._process_dataframe(df)
            
            # Add addresses to system
            added_count = 0
            failed_addresses = []
            
            for addr_data in addresses:
                try:
                    address = address_manager.add_address(**addr_data)
                    added_count += 1
                except Exception as e:
                    failed_addresses.append({
                        'data': addr_data,
                        'error': str(e)
                    })
                    logger.warning(f"Failed to add address {addr_data.get('address', 'Unknown')}: {str(e)}")
            
            # Geocode all new addresses
            if added_count > 0:
                logger.info(f"Starting geocoding for {added_count} addresses")
                geocoded_count = await address_manager.geocode_addresses()
                logger.info(f"Successfully geocoded {geocoded_count} addresses")
            
            return {
                'success': True,
                'total_rows': len(df),
                'addresses_added': added_count,
                'addresses_failed': len(failed_addresses),
                'failed_addresses': failed_addresses,
                'warnings': self.warnings,
                'geocoded_count': added_count,
                'message': f'Successfully imported {added_count} addresses from {file.filename}'
            }
            
        except Exception as e:
            logger.error(f"Error processing file {file.filename}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'validation_errors': self.validation_errors,
                'warnings': self.warnings
            }
    
    async def _validate_file(self, file: UploadFile):
        """Validate uploaded file"""
        # Check file extension
        if not any(file.filename.lower().endswith(ext) for ext in self.SUPPORTED_FORMATS):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format. Supported formats: {', '.join(self.SUPPORTED_FORMATS)}"
            )
        
        # Check file size (approximate)
        file_size = 0
        content = await file.read()
        file_size = len(content)
        await file.seek(0)  # Reset file pointer
        
        if file_size > self.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {self.MAX_FILE_SIZE // 1024 // 1024}MB"
            )
        
        if file_size == 0:
            raise HTTPException(status_code=400, detail="File is empty")
    
    async def _parse_file(self, content: bytes, filename: str) -> pd.DataFrame:
        """Parse file content into DataFrame"""
        try:
            if filename.lower().endswith('.csv'):
                # Try different encodings for CSV
                for encoding in ['utf-8', 'utf-8-sig', 'latin1', 'cp1252']:
                    try:
                        df = pd.read_csv(io.BytesIO(content), encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    raise ValueError("Could not decode CSV file with any supported encoding")
                    
            elif filename.lower().endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
            else:
                raise ValueError("Unsupported file format")
                
            if df.empty:
                raise ValueError("File contains no data")
                
            if len(df) > self.MAX_ADDRESSES:
                raise ValueError(f"Too many addresses. Maximum allowed: {self.MAX_ADDRESSES}")
                
            return df
            
        except Exception as e:
            raise ValueError(f"Error parsing file: {str(e)}")
    
    async def _process_dataframe(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Process DataFrame and extract address data"""
        # Normalize column names
        df.columns = df.columns.str.lower().str.strip()
        
        # Map columns to expected names
        column_map = self._map_columns(df.columns.tolist())
        
        # Check required columns
        if 'address' not in column_map:
            raise ValueError("Address column is required but not found. Expected column names: " + 
                           ", ".join(self.COLUMN_MAPPING['address']))
        
        addresses = []
        
        for index, row in df.iterrows():
            try:
                # Extract address data
                addr_data = self._extract_address_data(row, column_map, index)
                if addr_data:
                    addresses.append(addr_data)
            except Exception as e:
                self.validation_errors.append(f"Row {index + 2}: {str(e)}")  # +2 for header and 0-indexing
                continue
        
        if not addresses:
            raise ValueError("No valid addresses found in file")
            
        return addresses
    
    def _map_columns(self, columns: List[str]) -> Dict[str, str]:
        """Map file columns to expected field names"""
        column_map = {}
        
        for field, possible_names in self.COLUMN_MAPPING.items():
            for col in columns:
                if col.lower() in [name.lower() for name in possible_names]:
                    column_map[field] = col
                    break
        
        return column_map
    
    def _extract_address_data(self, row: pd.Series, column_map: Dict[str, str], row_index: int) -> Optional[Dict[str, Any]]:
        """Extract and validate address data from a row"""
        try:
            # Get address (required)
            address = None
            if 'address' in column_map:
                address = str(row[column_map['address']]).strip()
                
            if not address or address.lower() in ['nan', 'null', '']:
                self.warnings.append(f"Row {row_index + 2}: Empty address, skipping")
                return None
            
            # Get delivery ID (optional)
            delivery_id = None
            if 'delivery_id' in column_map:
                delivery_id_val = row[column_map['delivery_id']]
                if pd.notna(delivery_id_val) and str(delivery_id_val).strip():
                    delivery_id = str(delivery_id_val).strip()
            
            # Get bottles (optional, default 0)
            bottles = 0
            if 'bottles' in column_map:
                bottles_val = row[column_map['bottles']]
                if pd.notna(bottles_val):
                    try:
                        bottles = int(float(bottles_val))
                        if bottles < 0 or bottles > 80:
                            raise ValueError(f"Bottles must be between 0 and 80, got {bottles}")
                    except (ValueError, TypeError):
                        self.warnings.append(f"Row {row_index + 2}: Invalid bottles value '{bottles_val}', using 0")
                        bottles = 0
            
            # Get priority (optional)
            priority = None
            if 'priority' in column_map:
                priority_val = row[column_map['priority']]
                if pd.notna(priority_val):
                    try:
                        priority_int = int(float(priority_val))
                        if priority_int in [1, 2, 3]:
                            priority = Priority(priority_int)
                        else:
                            self.warnings.append(f"Row {row_index + 2}: Invalid priority '{priority_val}', using standard")
                    except (ValueError, TypeError):
                        # Try text-based priority
                        priority_str = str(priority_val).lower().strip()
                        priority_mapping = {
                            'low': Priority(1), 'niedrig': Priority(1), '1': Priority(1),
                            'medium': Priority(2), 'mittel': Priority(2), '2': Priority(2),
                            'high': Priority(3), 'hoch': Priority(3), '3': Priority(3)
                        }
                        if priority_str in priority_mapping:
                            priority = priority_mapping[priority_str]
                        else:
                            self.warnings.append(f"Row {row_index + 2}: Invalid priority '{priority_val}', using standard")
            
            return {
                'address': address,
                'delivery_id': delivery_id,
                'bottles': bottles,
                'priority': priority
            }
            
        except Exception as e:
            raise ValueError(f"Error processing row data: {str(e)}")
    
    def generate_sample_file(self, format_type: str = 'excel') -> Tuple[bytes, str]:
        """Generate a sample file for users to download"""
        sample_data = {
            'Address': [
                'München, Deutschland',
                'Augsburg, Deutschland', 
                'Starnberg, Deutschland',
                'Freising, Deutschland',
                'Ingolstadt, Deutschland'
            ],
            'Delivery_ID': [
                'MU001',
                'AU002', 
                'ST003',
                'FR004',
                'IN005'
            ],
            'Bottles': [35, 25, 40, 30, 20],
            'Priority': ['High', 'Medium', 'High', 'Low', 'Standard']
        }
        
        df = pd.DataFrame(sample_data)
        
        if format_type.lower() == 'csv':
            output = io.BytesIO()
            df.to_csv(output, index=False, encoding='utf-8-sig')
            content = output.getvalue()
            filename = 'aboutwater_sample_addresses.csv'
        else:
            output = io.BytesIO()
            df.to_excel(output, index=False, engine='openpyxl')
            content = output.getvalue()
            filename = 'aboutwater_sample_addresses.xlsx'
        
        return content, filename

# Global file processor instance
file_processor = FileProcessor()