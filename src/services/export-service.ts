/**
 * Multi-format Export Service
 * Handles exporting route data to various formats with platform detection
 */

import type {
  OptimizedTour,
  DeliveryAddress,
  Coordinates,
  ExportFormat,
  ExportFormatUI,
} from '@/types'

export interface ExportOptions {
  readonly format: ExportFormatUI
  readonly tours: readonly OptimizedTour[]
  readonly hqLocation: Coordinates
  readonly includeMetadata: boolean
  readonly filename?: string
}

export interface ExportResult {
  readonly success: boolean
  readonly message: string
  readonly url?: string
  readonly data?: unknown
}

class ExportService {
  /**
   * Export tours to the specified format
   */
  public async exportTours(options: ExportOptions): Promise<ExportResult> {
    try {
      switch (options.format) {
        case 'GOOGLE_MAPS':
          return this.exportToGoogleMaps(options)
        case 'APPLE_MAPS':
          return this.exportToAppleMaps(options)
        case 'CSV':
          return this.exportToCsv(options)
        case 'EXCEL':
          return this.exportToExcel(options)
        case 'PDF':
          return this.exportToPdf(options)
        case 'JSON':
          return this.exportToJson(options)
        default:
          throw new Error(`Unsupported export format: ${options.format}`)
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Export failed',
      }
    }
  }

  /**
   * Export to Google Maps
   */
  private async exportToGoogleMaps(options: ExportOptions): Promise<ExportResult> {
    const { tours, hqLocation } = options

    if (tours.length === 0) {
      return {
        success: false,
        message: 'No tours to export',
      }
    }

    // Detect platform for optimal URL format
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isAndroid = /Android/.test(navigator.userAgent)
    
    // Export each tour individually for better mobile experience
    const exportedTours = []

    for (const [index, tour] of tours.entries()) {
      const waypoints = [
        encodeURIComponent(`${hqLocation.lat},${hqLocation.lng}`), // Start at HQ
        ...tour.addresses.map(addr => 
          encodeURIComponent(`${addr.coordinates.lat},${addr.coordinates.lng}`)
        ),
        encodeURIComponent(`${hqLocation.lat},${hqLocation.lng}`), // Return to HQ
      ]

      let url: string

      if (isIOS) {
        // iOS: Try Google Maps app first, fallback to Apple Maps
        url = `comgooglemaps://?saddr=${waypoints[0]}&daddr=${waypoints[waypoints.length - 1]}&waypoints=${waypoints.slice(1, -1).join('|')}`
        
        // Attempt to open Google Maps app
        const opened = this.tryOpenApp(url)
        
        if (!opened) {
          // Fallback to Apple Maps
          const appleMapsUrl = `http://maps.apple.com/?saddr=${waypoints[0]}&daddr=${waypoints[waypoints.length - 1]}`
          window.open(appleMapsUrl, '_blank')
        }
      } else if (isAndroid) {
        // Android: Google Maps app or web
        url = `https://www.google.com/maps/dir/${waypoints.join('/')}`
        window.open(url, '_blank')
      } else {
        // Desktop: Web Google Maps with optimized route
        url = `https://www.google.com/maps/dir/${waypoints.join('/')}`
        window.open(url, '_blank')
      }

      exportedTours.push({
        tourId: tour.id,
        tourName: `Tour ${index + 1}`,
        stops: tour.addresses.length,
        url,
      })

      // Add delay between exports to avoid overwhelming
      if (index < tours.length - 1) {
        await this.delay(2000)
      }
    }

    return {
      success: true,
      message: `Successfully exported ${exportedTours.length} tours to Google Maps`,
      data: exportedTours,
    }
  }

  /**
   * Export to Apple Maps
   */
  private async exportToAppleMaps(options: ExportOptions): Promise<ExportResult> {
    const { tours, hqLocation } = options

    if (tours.length === 0) {
      return {
        success: false,
        message: 'No tours to export',
      }
    }

    const exportedTours = []

    for (const [index, tour] of tours.entries()) {
      const startCoord = `${hqLocation.lat},${hqLocation.lng}`
      const endCoord = `${hqLocation.lat},${hqLocation.lng}`
      
      // Apple Maps doesn't support multiple waypoints well, so we'll open to the first stop
      const firstStop = tour.addresses[0]
      if (!firstStop) continue

      const url = `http://maps.apple.com/?saddr=${startCoord}&daddr=${firstStop.coordinates.lat},${firstStop.coordinates.lng}`
      
      window.open(url, '_blank')

      exportedTours.push({
        tourId: tour.id,
        tourName: `Tour ${index + 1}`,
        stops: tour.addresses.length,
        url,
        note: 'Only first stop shown - Apple Maps has limited waypoint support',
      })

      if (index < tours.length - 1) {
        await this.delay(2000)
      }
    }

    return {
      success: true,
      message: `Successfully exported ${exportedTours.length} tours to Apple Maps`,
      data: exportedTours,
    }
  }

  /**
   * Export to CSV format
   */
  private async exportToCsv(options: ExportOptions): Promise<ExportResult> {
    const { tours, includeMetadata, filename } = options

    if (tours.length === 0) {
      return {
        success: false,
        message: 'No tours to export',
      }
    }

    const headers = [
      'Tour ID',
      'Tour Number', 
      'Stop Order',
      'Delivery ID',
      'Address',
      'Latitude',
      'Longitude',
      'Bottles',
      'Priority',
      'Address Type',
      'Customer Notes',
      'Access Instructions',
      'Estimated Duration (min)',
    ]

    if (includeMetadata) {
      headers.push(
        'Total Tour Distance (km)',
        'Total Tour Duration (min)',
        'Total Tour Bottles',
        'Tour Efficiency (%)',
        'Created At',
        'Optimized At'
      )
    }

    const rows: string[][] = [headers]

    tours.forEach((tour, tourIndex) => {
      tour.addresses.forEach((address, stopIndex) => {
        const row = [
          tour.id,
          (tourIndex + 1).toString(),
          (stopIndex + 1).toString(),
          address.deliveryId,
          address.address,
          address.coordinates.lat.toString(),
          address.coordinates.lng.toString(),
          address.bottleCount.toString(),
          address.priority.toString(),
          address.addressType,
          address.customerNotes || '',
          address.accessInstructions || '',
          address.estimatedDuration.toString(),
        ]

        if (includeMetadata) {
          row.push(
            tour.estimatedDistance.toFixed(2),
            tour.estimatedDuration.toString(),
            tour.totalBottles.toString(),
            tour.metrics.efficiency.toFixed(1),
            tour.createdAt.toISOString(),
            tour.optimizedAt.toISOString()
          )
        }

        rows.push(row)
      })
    })

    const csvContent = rows.map(row => 
      row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    this.downloadFile(
      url, 
      filename || `aboutwater-routes-${new Date().toISOString().split('T')[0]}.csv`
    )

    return {
      success: true,
      message: 'Successfully exported tours to CSV',
      url,
    }
  }

  /**
   * Export to Excel format
   */
  private async exportToExcel(options: ExportOptions): Promise<ExportResult> {
    const { tours, includeMetadata, filename } = options

    try {
      // Dynamic import for xlsx library
      const XLSX = await import('xlsx')

      if (tours.length === 0) {
        return {
          success: false,
          message: 'No tours to export',
        }
      }

      // Create workbook with multiple sheets
      const workbook = XLSX.utils.book_new()

      // Summary sheet
      const summaryData = [
        ['aboutwater Route Optimization Export'],
        ['Generated:', new Date().toISOString()],
        [''],
        ['Summary Statistics:'],
        ['Total Tours:', tours.length],
        ['Total Addresses:', tours.reduce((sum, tour) => sum + tour.addresses.length, 0)],
        ['Total Bottles:', tours.reduce((sum, tour) => sum + tour.totalBottles, 0)],
        ['Total Distance (km):', tours.reduce((sum, tour) => sum + tour.estimatedDistance, 0).toFixed(2)],
        ['Total Duration (hours):', (tours.reduce((sum, tour) => sum + tour.estimatedDuration, 0) / 60).toFixed(2)],
      ]

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

      // Detailed routes sheet
      const detailHeaders = [
        'Tour ID', 'Tour #', 'Stop Order', 'Delivery ID', 'Address', 
        'Latitude', 'Longitude', 'Bottles', 'Priority', 'Address Type',
        'Customer Notes', 'Access Instructions', 'Est. Duration (min)'
      ]

      if (includeMetadata) {
        detailHeaders.push(
          'Tour Distance (km)', 'Tour Duration (min)', 'Tour Bottles',
          'Tour Efficiency (%)', 'Created At', 'Optimized At'
        )
      }

      const detailData = [detailHeaders]

      tours.forEach((tour, tourIndex) => {
        tour.addresses.forEach((address, stopIndex) => {
          const row = [
            tour.id,
            tourIndex + 1,
            stopIndex + 1,
            address.deliveryId,
            address.address,
            address.coordinates.lat,
            address.coordinates.lng,
            address.bottleCount,
            address.priority,
            address.addressType,
            address.customerNotes || '',
            address.accessInstructions || '',
            address.estimatedDuration,
          ]

          if (includeMetadata) {
            row.push(
              tour.estimatedDistance,
              tour.estimatedDuration,
              tour.totalBottles,
              tour.metrics.efficiency,
              tour.createdAt.toISOString(),
              tour.optimizedAt.toISOString()
            )
          }

          detailData.push(row)
        })
      })

      const detailSheet = XLSX.utils.aoa_to_sheet(detailData)
      
      // Set column widths
      const columnWidths = [
        { wch: 15 }, // Tour ID
        { wch: 8 },  // Tour #
        { wch: 10 }, // Stop Order
        { wch: 15 }, // Delivery ID
        { wch: 40 }, // Address
        { wch: 12 }, // Latitude
        { wch: 12 }, // Longitude
        { wch: 8 },  // Bottles
        { wch: 8 },  // Priority
        { wch: 12 }, // Address Type
        { wch: 30 }, // Customer Notes
        { wch: 30 }, // Access Instructions
        { wch: 15 }, // Duration
      ]

      if (includeMetadata) {
        columnWidths.push(
          { wch: 15 }, // Tour Distance
          { wch: 15 }, // Tour Duration
          { wch: 12 }, // Tour Bottles
          { wch: 12 }, // Tour Efficiency
          { wch: 20 }, // Created At
          { wch: 20 }  // Optimized At
        )
      }

      detailSheet['!cols'] = columnWidths
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Routes Detail')

      // Individual tour sheets
      tours.forEach((tour, index) => {
        const tourData = [
          [`Tour ${index + 1} - ${tour.name}`],
          ['Distance:', `${tour.estimatedDistance.toFixed(2)} km`],
          ['Duration:', `${(tour.estimatedDuration / 60).toFixed(2)} hours`],
          ['Bottles:', tour.totalBottles],
          ['Efficiency:', `${tour.metrics.efficiency.toFixed(1)}%`],
          [''],
          ['Stop Order', 'Delivery ID', 'Address', 'Bottles', 'Priority'],
          ...tour.addresses.map((address, stopIndex) => [
            stopIndex + 1,
            address.deliveryId,
            address.address,
            address.bottleCount,
            address.priority,
          ])
        ]

        const tourSheet = XLSX.utils.aoa_to_sheet(tourData)
        tourSheet['!cols'] = [
          { wch: 12 }, { wch: 15 }, { wch: 40 }, { wch: 8 }, { wch: 8 }
        ]
        
        XLSX.utils.book_append_sheet(workbook, tourSheet, `Tour ${index + 1}`)
      })

      // Generate file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
      })
      
      const url = URL.createObjectURL(blob)
      this.downloadFile(
        url,
        filename || `aboutwater-routes-${new Date().toISOString().split('T')[0]}.xlsx`
      )

      return {
        success: true,
        message: 'Successfully exported tours to Excel',
        url,
      }

    } catch (error) {
      return {
        success: false,
        message: 'Failed to export to Excel: ' + (error instanceof Error ? error.message : 'Unknown error'),
      }
    }
  }

  /**
   * Export to PDF format
   */
  private async exportToPdf(options: ExportOptions): Promise<ExportResult> {
    const { tours, includeMetadata, filename } = options

    try {
      // For now, create a simple HTML print version
      // In production, would use a library like jsPDF or Puppeteer
      
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        throw new Error('Could not open print window - popup blocked?')
      }

      const htmlContent = this.generatePrintableHtml(tours, includeMetadata)
      
      printWindow.document.write(htmlContent)
      printWindow.document.close()
      
      // Trigger print dialog
      setTimeout(() => {
        printWindow.print()
      }, 500)

      return {
        success: true,
        message: 'PDF print dialog opened - use your browser to save as PDF',
      }

    } catch (error) {
      return {
        success: false,
        message: 'Failed to export to PDF: ' + (error instanceof Error ? error.message : 'Unknown error'),
      }
    }
  }

  /**
   * Export to JSON format
   */
  private async exportToJson(options: ExportOptions): Promise<ExportResult> {
    const { tours, includeMetadata, filename } = options

    if (tours.length === 0) {
      return {
        success: false,
        message: 'No tours to export',
      }
    }

    const exportData = {
      version: '4.0.0',
      exportDate: new Date().toISOString(),
      exportFormat: 'JSON',
      includeMetadata,
      summary: {
        totalTours: tours.length,
        totalAddresses: tours.reduce((sum, tour) => sum + tour.addresses.length, 0),
        totalBottles: tours.reduce((sum, tour) => sum + tour.totalBottles, 0),
        totalDistance: tours.reduce((sum, tour) => sum + tour.estimatedDistance, 0),
        totalDuration: tours.reduce((sum, tour) => sum + tour.estimatedDuration, 0),
      },
      tours: includeMetadata ? tours : tours.map(tour => ({
        id: tour.id,
        name: tour.name,
        addresses: tour.addresses,
        sequence: tour.sequence,
        totalBottles: tour.totalBottles,
        estimatedDistance: tour.estimatedDistance,
        estimatedDuration: tour.estimatedDuration,
      })),
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    this.downloadFile(
      url,
      filename || `aboutwater-routes-${new Date().toISOString().split('T')[0]}.json`
    )

    return {
      success: true,
      message: 'Successfully exported tours to JSON',
      url,
      data: exportData,
    }
  }

  /**
   * Generate printable HTML for PDF export
   */
  private generatePrintableHtml(tours: readonly OptimizedTour[], includeMetadata: boolean): string {
    const currentDate = new Date().toLocaleDateString()
    const currentTime = new Date().toLocaleTimeString()

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>aboutwater Route Optimization Report</title>
          <style>
            @media print {
              body { margin: 0; }
              .page-break { page-break-after: always; }
              .no-print { display: none; }
            }
            body {
              font-family: 'Arial', sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #1c5975;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #1c5975;
              margin-bottom: 10px;
            }
            .summary {
              background: #f8fafc;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .tour {
              margin-bottom: 30px;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 20px;
            }
            .tour-header {
              background: #1c5975;
              color: white;
              padding: 10px 15px;
              border-radius: 6px;
              margin-bottom: 15px;
            }
            .stop {
              padding: 10px;
              border-bottom: 1px solid #f1f5f9;
              display: flex;
              align-items: center;
            }
            .stop:last-child {
              border-bottom: none;
            }
            .stop-number {
              background: #1c5975;
              color: white;
              width: 30px;
              height: 30px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              margin-right: 15px;
              flex-shrink: 0;
            }
            .stop-details {
              flex: 1;
            }
            .priority-high { color: #dc2626; font-weight: bold; }
            .priority-medium { color: #d97706; }
            .priority-low { color: #059669; }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin-top: 20px;
            }
            .summary-item {
              text-align: center;
              padding: 15px;
              background: white;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
            }
            .summary-value {
              font-size: 28px;
              font-weight: bold;
              color: #1c5975;
              margin-bottom: 5px;
            }
            .summary-label {
              font-size: 12px;
              color: #64748b;
              text-transform: uppercase;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 12px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">aboutwater Route Optimizer</div>
            <div>Route Optimization Report</div>
            <div style="font-size: 14px; color: #64748b; margin-top: 10px;">
              Generated on ${currentDate} at ${currentTime}
            </div>
          </div>

          <div class="summary">
            <h2 style="margin-top: 0; color: #1c5975;">Summary Statistics</h2>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-value">${tours.length}</div>
                <div class="summary-label">Total Tours</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${tours.reduce((sum, tour) => sum + tour.addresses.length, 0)}</div>
                <div class="summary-label">Total Stops</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${tours.reduce((sum, tour) => sum + tour.totalBottles, 0)}</div>
                <div class="summary-label">Total Bottles</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${tours.reduce((sum, tour) => sum + tour.estimatedDistance, 0).toFixed(1)}km</div>
                <div class="summary-label">Total Distance</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${(tours.reduce((sum, tour) => sum + tour.estimatedDuration, 0) / 60).toFixed(1)}h</div>
                <div class="summary-label">Total Time</div>
              </div>
            </div>
          </div>

          ${tours.map((tour, index) => `
            <div class="tour">
              <div class="tour-header">
                <h3 style="margin: 0;">Tour ${index + 1} - ${tour.name}</h3>
                <div style="font-size: 14px; opacity: 0.9; margin-top: 5px;">
                  ${tour.addresses.length} stops • ${tour.totalBottles} bottles • 
                  ${tour.estimatedDistance.toFixed(1)}km • ${(tour.estimatedDuration / 60).toFixed(1)}h
                  ${includeMetadata ? ` • ${tour.metrics.efficiency.toFixed(1)}% efficient` : ''}
                </div>
              </div>
              
              ${tour.addresses.map((address, stopIndex) => `
                <div class="stop">
                  <div class="stop-number">${stopIndex + 1}</div>
                  <div class="stop-details">
                    <div style="font-weight: bold; margin-bottom: 5px;">
                      ${address.deliveryId}
                    </div>
                    <div style="margin-bottom: 3px;">${address.address}</div>
                    <div style="font-size: 12px; color: #64748b;">
                      ${address.bottleCount} bottles • 
                      <span class="priority-${address.priority <= 2 ? 'high' : address.priority <= 3 ? 'medium' : 'low'}">
                        Priority ${address.priority}
                      </span> • 
                      ${address.addressType.toLowerCase()}
                      ${address.estimatedDuration ? ` • ${address.estimatedDuration}min` : ''}
                    </div>
                    ${address.customerNotes ? `
                      <div style="font-size: 12px; margin-top: 5px; padding: 5px; background: #f8fafc; border-radius: 4px;">
                        <strong>Notes:</strong> ${address.customerNotes}
                      </div>
                    ` : ''}
                    ${address.accessInstructions ? `
                      <div style="font-size: 12px; margin-top: 5px; padding: 5px; background: #fef3c7; border-radius: 4px;">
                        <strong>Access:</strong> ${address.accessInstructions}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
            ${index < tours.length - 1 ? '<div class="page-break"></div>' : ''}
          `).join('')}

          <div class="footer">
            <div>Generated by aboutwater Route Optimizer v4.0.0</div>
            <div style="margin-top: 5px;">making water your water</div>
          </div>

          <script>
            // Auto-focus for print
            window.onload = function() {
              window.focus();
            };
          </script>
        </body>
      </html>
    `
  }

  /**
   * Try to open an app URL (for mobile)
   */
  private tryOpenApp(url: string): boolean {
    try {
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = url
      document.body.appendChild(iframe)
      
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
      
      return true
    } catch (error) {
      console.warn('Could not open app:', error)
      return false
    }
  }

  /**
   * Download a file from a URL
   */
  private downloadFile(url: string, filename: string): void {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get supported export formats based on current platform
   */
  public getSupportedFormats(): Array<{
    format: ExportFormatUI
    label: string
    description: string
    icon: string
  }> {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isAndroid = /Android/.test(navigator.userAgent)

    const formats = [
      {
        format: 'GOOGLE_MAPS' as ExportFormatUI,
        label: 'Google Maps',
        description: 'Open routes in Google Maps app or web',
        icon: '🗺️',
      },
      {
        format: 'CSV' as ExportFormatUI,
        label: 'CSV File',
        description: 'Comma-separated values for spreadsheet apps',
        icon: '📊',
      },
      {
        format: 'EXCEL' as ExportFormatUI,
        label: 'Excel File',
        description: 'Microsoft Excel workbook with multiple sheets',
        icon: '📈',
      },
      {
        format: 'JSON' as ExportFormatUI,
        label: 'JSON Data',
        description: 'Machine-readable data format',
        icon: '💾',
      },
      {
        format: 'PDF' as ExportFormatUI,
        label: 'PDF Report',
        description: 'Printable route report',
        icon: '📄',
      },
    ]

    // Add Apple Maps for iOS devices
    if (isIOS) {
      formats.splice(1, 0, {
        format: 'APPLE_MAPS' as ExportFormatUI,
        label: 'Apple Maps',
        description: 'Open routes in Apple Maps (iOS only)',
        icon: '🍎',
      })
    }

    return formats
  }
}

export const exportService = new ExportService()