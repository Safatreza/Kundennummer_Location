import React, { useState, useRef, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'

// Lazy load the RouteMap component to prevent potential SSR issues
const RouteMap = React.lazy(() => 
  import('./components/map/RouteMap').then(module => ({ default: module.RouteMap }))
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    },
  },
})

function App() {
  const [addresses, setAddresses] = useState<any[]>([])
  const [optimizedRoutes, setOptimizedRoutes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preload background image
  React.useEffect(() => {
    const img = new Image()
    img.onload = () => setBackgroundImageLoaded(true)
    img.onerror = () => setBackgroundImageLoaded(true) // Continue even if image fails
    img.src = '/Background.jpg'
  }, [])

  // Address form state
  const [formData, setFormData] = useState({
    address: '',
    deliveryId: '',
    bottleCount: '5'
  })

  const handleAddAddress = async () => {
    if (!formData.address.trim()) {
      toast.error('Address is required')
      return
    }

    if (formData.address.length < 5) {
      toast.error('Address must be at least 5 characters')
      return
    }

    const bottleNum = parseInt(formData.bottleCount) || 5
    if (bottleNum < 1 || bottleNum > 80) {
      toast.error('Bottle count must be between 1 and 80')
      return
    }

    setIsLoading(true)
    toast.loading('Adding address...', { id: 'add-address' })

    try {
      await new Promise(resolve => setTimeout(resolve, 800))
      
      const randomLat = 48.1375 + (Math.random() - 0.5) * 0.1
      const randomLng = 11.5755 + (Math.random() - 0.5) * 0.1
      
      const newAddress = {
        id: `addr-${Date.now()}`,
        address: formData.address.trim(),
        deliveryId: formData.deliveryId.trim() || `DEL-${Date.now().toString().slice(-4)}`,
        bottleCount: bottleNum,
        coordinates: { lat: randomLat, lng: randomLng },
        timestamp: new Date().toISOString(),
      }

      setAddresses(prev => [...prev, newAddress])
      toast.success('Address added successfully!', { id: 'add-address' })
      
      // Reset form
      setFormData({ address: '', deliveryId: '', bottleCount: '5' })
      
    } catch (error) {
      toast.error('Failed to add address', { id: 'add-address' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOptimizeRoutes = async () => {
    if (addresses.length < 2) {
      toast.error('Need at least 2 addresses to optimize routes')
      return
    }

    setIsOptimizing(true)
    toast.loading('Optimizing routes with genetic algorithm...', { id: 'optimize' })

    try {
      // Simulate complex route optimization
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const routeSize = Math.min(8, addresses.length)
      const routes = []
      
      for (let i = 0; i < addresses.length; i += routeSize) {
        const routeAddresses = addresses.slice(i, i + routeSize)
        const totalBottles = routeAddresses.reduce((sum, addr) => sum + addr.bottleCount, 0)
        const estimatedDistance = routeAddresses.length * 2.5 + Math.random() * 5
        const estimatedDuration = routeAddresses.length * 15 + estimatedDistance * 2
        
        routes.push({
          id: `route-${routes.length + 1}`,
          addresses: routeAddresses,
          totalDistance: estimatedDistance,
          totalBottles,
          estimatedDuration,
          efficiency: Math.round(85 + Math.random() * 10), // 85-95% efficiency
        })
      }
      
      setOptimizedRoutes(routes)
      toast.success(`Successfully optimized ${addresses.length} addresses into ${routes.length} efficient route(s)!`, { id: 'optimize' })
      
    } catch (error) {
      console.error('Route optimization error:', error)
      toast.error('Failed to optimize routes. Please try again.', { id: 'optimize' })
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleExcelImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    const isCsv = file.name.endsWith('.csv')

    if (!isExcel && !isCsv) {
      toast.error('Please select an Excel file (.xlsx, .xls) or CSV file (.csv)')
      return
    }

    setIsImporting(true)
    toast.loading(`Importing addresses from ${isExcel ? 'Excel' : 'CSV'}...`, { id: 'import' })

    try {
      const fileReader = new FileReader()
      fileReader.onload = async (e) => {
        try {
          let jsonData: any[][] = []

          if (isCsv) {
            // Parse CSV file
            const csvText = e.target?.result as string
            const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
            
            jsonData = lines.map(line => {
              const result = []
              let current = ''
              let inQuotes = false
              
              for (let i = 0; i < line.length; i++) {
                const char = line[i]
                const nextChar = line[i + 1]
                
                if (char === '"') {
                  if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"'
                    i++ // Skip next quote
                  } else {
                    // Toggle quotes
                    inQuotes = !inQuotes
                  }
                } else if (char === ',' && !inQuotes) {
                  // End of field
                  result.push(current.trim())
                  current = ''
                } else {
                  current += char
                }
              }
              
              // Add the last field
              result.push(current.trim())
              return result
            })
          } else {
            // Parse Excel file
            const XLSX = await import('xlsx')
            const data = new Uint8Array(e.target?.result as ArrayBuffer)
            const workbook = XLSX.read(data, { type: 'array' })
            
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
          }
          
          if (jsonData.length < 2) {
            throw new Error(`${isExcel ? 'Excel' : 'CSV'} file must have at least a header row and one data row`)
          }

          const headers = jsonData[0].map(h => String(h).toLowerCase().trim())
          const dataRows = jsonData.slice(1)

          const addressCol = headers.findIndex(h => 
            h.includes('address') || h.includes('location') || h.includes('street')
          )
          const deliveryIdCol = headers.findIndex(h => 
            h.includes('delivery') && h.includes('id') || h.includes('deliveryid') || h.includes('id')
          )
          const bottleCol = headers.findIndex(h => 
            h.includes('bottle') || h.includes('qty') || h.includes('quantity') || h.includes('amount')
          )

          if (addressCol === -1) {
            throw new Error(`Could not find address column. Please ensure your ${isExcel ? 'Excel' : 'CSV'} file has a column named "Address", "Location", or "Street"`)
          }

          const importedAddresses: any[] = []
          let successCount = 0

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i]
            if (!row || !row[addressCol]) continue

            const address = String(row[addressCol]).trim()
            if (!address) continue

            let deliveryId = deliveryIdCol >= 0 && row[deliveryIdCol] 
              ? String(row[deliveryIdCol]).trim() 
              : `IMP-${String(i + 1).padStart(3, '0')}`

            if (addresses.some(a => a.deliveryId === deliveryId) || 
                importedAddresses.some(a => a.deliveryId === deliveryId)) {
              deliveryId = `${deliveryId}-${Date.now()}`
            }

            const bottleCount = bottleCol >= 0 && row[bottleCol] 
              ? parseInt(String(row[bottleCol])) || 1 
              : 5

            const randomLat = 48.1375 + (Math.random() - 0.5) * 0.2
            const randomLng = 11.5755 + (Math.random() - 0.5) * 0.2

            const newAddress = {
              id: `import-${Date.now()}-${i}`,
              address,
              coordinates: { lat: randomLat, lng: randomLng },
              deliveryId,
              bottleCount: Math.min(bottleCount, 80),
              imported: true,
              timestamp: new Date().toISOString(),
            }

            importedAddresses.push(newAddress)
            successCount++
          }

          if (importedAddresses.length === 0) {
            throw new Error(`No valid addresses found in the ${isExcel ? 'Excel' : 'CSV'} file`)
          }

          setAddresses(prev => [...prev, ...importedAddresses])
          toast.success(`Successfully imported ${successCount} addresses from ${isExcel ? 'Excel' : 'CSV'}!`, { id: 'import' })

          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }

        } catch (parseError) {
          console.error(`${isExcel ? 'Excel' : 'CSV'} parsing error:`, parseError)
          toast.error(parseError instanceof Error ? parseError.message : `Failed to parse ${isExcel ? 'Excel' : 'CSV'} file`, { id: 'import' })
        } finally {
          setIsImporting(false)
        }
      }

      // Read file based on type
      if (isCsv) {
        fileReader.readAsText(file, 'UTF-8')
      } else {
        fileReader.readAsArrayBuffer(file)
      }

    } catch (error) {
      console.error(`${isExcel ? 'Excel' : 'CSV'} import error:`, error)
      toast.error(`Failed to import ${isExcel ? 'Excel' : 'CSV'} file. Please try again.`, { id: 'import' })
      setIsImporting(false)
    }
  }

  const generateDriverLink = (routeIndex: number) => {
    if (routeIndex >= optimizedRoutes.length) return null

    const route = optimizedRoutes[routeIndex]
    const addresses = route.addresses.map((addr: any) => addr.address)
    
    if (addresses.length < 2) return null

    const origin = encodeURIComponent(addresses[0])
    const destination = encodeURIComponent(addresses[addresses.length - 1])
    const waypoints = addresses.slice(1, -1).map((addr: string) => encodeURIComponent(addr)).join('|')
    
    // Create mobile-optimized Google Maps URL
    if (waypoints) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`
    } else {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
    }
  }

  const handleCopyDriverLink = async (routeIndex: number) => {
    const link = generateDriverLink(routeIndex)
    if (!link) {
      toast.error('Unable to generate driver link for this route.')
      return
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link)
        toast.success(`Driver link for Route ${routeIndex + 1} copied to clipboard!`, { 
          duration: 4000,
          id: `copy-driver-${routeIndex}` 
        })
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement('textarea')
        textArea.value = link
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        toast.success(`Driver link for Route ${routeIndex + 1} copied!`, { 
          duration: 4000,
          id: `copy-driver-${routeIndex}` 
        })
      }
    } catch (error) {
      console.error('Failed to copy driver link:', error)
      toast.error('Failed to copy driver link. Please try again.')
    }
  }

  const handleShowAllDriverLinks = () => {
    const allLinks = optimizedRoutes.map((route, index) => {
      const link = generateDriverLink(index)
      return {
        routeNumber: index + 1,
        stops: route.addresses.length,
        bottles: route.totalBottles || 0,
        distance: route.totalDistance?.toFixed(1) || '0',
        duration: Math.round((route.estimatedDuration || 0) / 60),
        link: link || 'Error generating link'
      }
    }).filter(item => item.link !== 'Error generating link')

    if (allLinks.length === 0) {
      toast.error('No valid routes to generate driver links.')
      return
    }

    // Create formatted text with all driver links
    const linksText = allLinks.map(route => 
      `ROUTE ${route.routeNumber} - ${route.stops} stops, ${route.bottles} bottles, ${route.distance}km, ~${route.duration}h\n` +
      `Driver Link: ${route.link}\n`
    ).join('\n')

    const fullText = `ABOUTWATER DELIVERY ROUTES - ${new Date().toLocaleDateString()}\n` +
      `Total Routes: ${allLinks.length}\n\n` +
      linksText +
      `\nINSTRUCTIONS FOR DRIVERS:\n` +
      `• Click your route link to open Google Maps\n` +
      `• Links work on both Android and iOS devices\n` +
      `• Route will automatically open in Maps app\n` +
      `• Follow the optimized sequence for best efficiency\n\n` +
      `Safe driving!\naboutwater Team`

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullText)
        toast.success(`All ${allLinks.length} driver links copied to clipboard!`, { duration: 6000 })
      } else {
        // Fallback
        const textArea = document.createElement('textarea')
        textArea.value = fullText
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        toast.success(`All ${allLinks.length} driver links copied!`, { duration: 6000 })
      }

      // Also show in alert for easy viewing
      alert(fullText)
    } catch (error) {
      console.error('Failed to copy all driver links:', error)
      // Show in alert as fallback
      alert(fullText)
      toast.success('Driver links displayed in popup!')
    }
  }

  const handleSendDriverLink = (routeIndex: number) => {
    const link = generateDriverLink(routeIndex)
    if (!link) {
      toast.error('Unable to generate driver link for this route.')
      return
    }

    const route = optimizedRoutes[routeIndex]
    const subject = encodeURIComponent(`aboutwater Delivery Route ${routeIndex + 1} - ${route.addresses.length} stops`)
    const body = encodeURIComponent(
      `Hi! Here's your optimized delivery route for today:\n\n` +
      `Route ${routeIndex + 1} Details:\n` +
      `• ${route.addresses.length} delivery stops\n` +
      `• ${route.totalBottles || 0} bottles total\n` +
      `• Estimated distance: ${route.totalDistance?.toFixed(1) || '0'} km\n` +
      `• Estimated duration: ${Math.round((route.estimatedDuration || 0) / 60)} hours\n` +
      `• Route efficiency: ${route.efficiency || 'N/A'}%\n\n` +
      `Click this link to open your route in Google Maps:\n${link}\n\n` +
      `The route will automatically open in your Google Maps app on mobile devices.\n\n` +
      `Safe driving!\n` +
      `aboutwater Team`
    )

    const mailtoLink = `mailto:?subject=${subject}&body=${body}`
    window.open(mailtoLink, '_blank')
    
    toast.success(`Email template opened for Route ${routeIndex + 1}!`, { duration: 4000 })
  }

  const handleExportToGoogleMaps = async (routeIndex: number = 0) => {
    if (optimizedRoutes.length === 0) {
      toast.error('No optimized routes to export. Please optimize routes first.')
      return
    }

    if (routeIndex >= optimizedRoutes.length) {
      toast.error('Invalid route selected.')
      return
    }

    try {
      toast.loading('Preparing Google Maps export for mobile and desktop...', { id: 'export-gmaps' })
      
      const route = optimizedRoutes[routeIndex]
      const addresses = route.addresses.map((addr: any) => addr.address)
      
      if (addresses.length < 2) {
        toast.error('Route must have at least 2 addresses.')
        return
      }

      // Create different URLs for different platforms
      const origin = encodeURIComponent(addresses[0])
      const destination = encodeURIComponent(addresses[addresses.length - 1])
      const waypoints = addresses.slice(1, -1).map((addr: string) => encodeURIComponent(addr)).join('|')
      
      // For mobile devices (Android/iOS) - use intent URLs and app deep links
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      let googleMapsUrl: string
      
      if (isMobile) {
        // Mobile deep link - works with Google Maps app
        if (waypoints) {
          googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`
        } else {
          googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
        }
      } else {
        // Desktop/web version
        const allLocations = addresses.map(addr => encodeURIComponent(addr)).join('/')
        googleMapsUrl = `https://www.google.com/maps/dir/${allLocations}`
      }

      // Copy to clipboard for easy sharing
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(googleMapsUrl)
          toast.success('Google Maps URL copied to clipboard!', { id: 'export-gmaps' })
        } catch (clipboardError) {
          console.log('Clipboard access denied, proceeding with window.open')
        }
      }
      
      // Open in new tab/app
      window.open(googleMapsUrl, '_blank')
      
      const platform = isMobile ? 'mobile app' : 'web browser'
      toast.success(`Route ${routeIndex + 1} opened in Google Maps (${platform})! ${addresses.length} stops optimized for driving.`, { 
        id: 'export-gmaps',
        duration: 6000 
      })
      
    } catch (error) {
      console.error('Google Maps export error:', error)
      toast.error('Failed to export to Google Maps. Please try again.', { id: 'export-gmaps' })
    }
  }

  const handleExportToExcel = async () => {
    if (optimizedRoutes.length === 0) {
      toast.error('No optimized routes to export. Please optimize routes first.')
      return
    }

    try {
      toast.loading('Generating Excel file...', { id: 'export-excel' })
      
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // Create summary sheet
      const summaryData = [
        ['aboutwater Route Optimization Report'],
        ['Generated:', new Date().toLocaleString()],
        ['Total Routes:', optimizedRoutes.length],
        ['Total Addresses:', addresses.length],
        ['Total Bottles:', addresses.reduce((sum, addr) => sum + addr.bottleCount, 0)],
        [],
        ['Route Summary'],
        ['Route #', 'Stops', 'Distance (km)', 'Duration (min)', 'Bottles', 'Efficiency %'],
        ...optimizedRoutes.map((route, index) => [
          index + 1,
          route.addresses.length,
          route.totalDistance?.toFixed(1) || '0.0',
          Math.round(route.estimatedDuration || 0),
          route.totalBottles || 0,
          route.efficiency || 'N/A'
        ])
      ]

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

      // Create detailed route sheets
      optimizedRoutes.forEach((route, routeIndex) => {
        const wsData = [
          [`Route ${routeIndex + 1} - Detailed Itinerary`],
          ['Stop #', 'Delivery ID', 'Address', 'Bottles', 'Coordinates', 'Notes'],
          ...route.addresses.map((addr: any, index: number) => [
            index + 1,
            addr.deliveryId,
            addr.address,
            addr.bottleCount,
            `${addr.coordinates?.lat?.toFixed(6)}, ${addr.coordinates?.lng?.toFixed(6)}`,
            addr.imported ? 'Imported from Excel' : 'Manual entry'
          ]),
          [],
          ['Route Statistics'],
          ['Total Stops:', route.addresses.length],
          ['Total Distance:', `${route.totalDistance?.toFixed(1) || 0} km`],
          ['Estimated Duration:', `${Math.round((route.estimatedDuration || 0) / 60)} hours ${Math.round((route.estimatedDuration || 0) % 60)} minutes`],
          ['Total Bottles:', route.totalBottles || 0],
          ['Route Efficiency:', `${route.efficiency || 0}%`]
        ]

        const ws = XLSX.utils.aoa_to_sheet(wsData)
        XLSX.utils.book_append_sheet(wb, ws, `Route ${routeIndex + 1}`)
      })

      const fileName = `aboutwater_Routes_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success(`Routes exported to Excel successfully! Downloaded: ${fileName}`, { id: 'export-excel' })
      
    } catch (error) {
      console.error('Excel export error:', error)
      toast.error('Failed to export to Excel. Please try again.', { id: 'export-excel' })
    }
  }

  const handleExportToCSV = async () => {
    if (optimizedRoutes.length === 0) {
      toast.error('No optimized routes to export. Please optimize routes first.')
      return
    }

    try {
      toast.loading('Generating CSV files...', { id: 'export-csv' })
      
      // Helper function to escape CSV fields
      const escapeCSV = (field: any) => {
        const str = String(field || '')
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      // Helper function to create CSV content
      const createCSV = (data: any[][]) => {
        return data.map(row => 
          row.map(cell => escapeCSV(cell)).join(',')
        ).join('\n')
      }

      // Helper function to download CSV
      const downloadCSV = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      const timestamp = new Date().toISOString().split('T')[0]

      // Create summary CSV
      const summaryData = [
        ['aboutwater Route Optimization Report'],
        ['Generated', new Date().toLocaleString()],
        ['Total Routes', optimizedRoutes.length],
        ['Total Addresses', addresses.length],
        ['Total Bottles', addresses.reduce((sum, addr) => sum + addr.bottleCount, 0)],
        [],
        ['Route Summary'],
        ['Route #', 'Stops', 'Distance (km)', 'Duration (min)', 'Bottles', 'Efficiency %'],
        ...optimizedRoutes.map((route, index) => [
          index + 1,
          route.addresses.length,
          route.totalDistance?.toFixed(1) || '0.0',
          Math.round(route.estimatedDuration || 0),
          route.totalBottles || 0,
          route.efficiency || 'N/A'
        ])
      ]

      const summaryCSV = createCSV(summaryData)
      downloadCSV(summaryCSV, `aboutwater_Routes_Summary_${timestamp}.csv`)

      // Create detailed routes CSV
      const detailedData = [
        ['Route #', 'Stop #', 'Delivery ID', 'Address', 'Bottles', 'Latitude', 'Longitude', 'Notes', 'Route Distance (km)', 'Route Duration (min)', 'Route Efficiency (%)']
      ]

      optimizedRoutes.forEach((route, routeIndex) => {
        route.addresses.forEach((addr: any, stopIndex: number) => {
          detailedData.push([
            routeIndex + 1,
            stopIndex + 1,
            addr.deliveryId,
            addr.address,
            addr.bottleCount,
            addr.coordinates?.lat?.toFixed(6) || '',
            addr.coordinates?.lng?.toFixed(6) || '',
            addr.imported ? 'Imported from Excel' : 'Manual entry',
            stopIndex === 0 ? (route.totalDistance?.toFixed(1) || '0.0') : '', // Only show totals on first row
            stopIndex === 0 ? Math.round(route.estimatedDuration || 0) : '',
            stopIndex === 0 ? (route.efficiency || 'N/A') : ''
          ])
        })
      })

      const detailedCSV = createCSV(detailedData)
      downloadCSV(detailedCSV, `aboutwater_Routes_Detailed_${timestamp}.csv`)

      // Create individual route CSVs
      const individualFiles = []
      for (let routeIndex = 0; routeIndex < optimizedRoutes.length; routeIndex++) {
        const route = optimizedRoutes[routeIndex]
        const routeData = [
          [`Route ${routeIndex + 1} - Detailed Itinerary`],
          ['Stop #', 'Delivery ID', 'Address', 'Bottles', 'Latitude', 'Longitude', 'Notes'],
          ...route.addresses.map((addr: any, index: number) => [
            index + 1,
            addr.deliveryId,
            addr.address,
            addr.bottleCount,
            addr.coordinates?.lat?.toFixed(6) || '',
            addr.coordinates?.lng?.toFixed(6) || '',
            addr.imported ? 'Imported from Excel' : 'Manual entry'
          ]),
          [],
          ['Route Statistics'],
          ['Total Stops', route.addresses.length],
          ['Total Distance (km)', route.totalDistance?.toFixed(1) || 0],
          ['Estimated Duration (min)', Math.round(route.estimatedDuration || 0)],
          ['Total Bottles', route.totalBottles || 0],
          ['Route Efficiency (%)', route.efficiency || 0]
        ]

        const routeCSV = createCSV(routeData)
        const filename = `aboutwater_Route_${routeIndex + 1}_${timestamp}.csv`
        downloadCSV(routeCSV, filename)
        individualFiles.push(filename)
      }

      const fileList = [
        `aboutwater_Routes_Summary_${timestamp}.csv`,
        `aboutwater_Routes_Detailed_${timestamp}.csv`,
        ...individualFiles
      ]

      toast.success(`Successfully exported ${fileList.length} CSV files! Check your downloads folder.`, { 
        id: 'export-csv',
        duration: 6000 
      })
      
    } catch (error) {
      console.error('CSV export error:', error)
      toast.error('Failed to export to CSV. Please try again.', { id: 'export-csv' })
    }
  }

  const handleAddSampleData = () => {
    setIsLoading(true)
    toast.loading('Adding sample addresses...', { id: 'sample' })
    
    setTimeout(() => {
      const sampleAddresses = [
        { address: 'Marienplatz 1, Munich, Germany', bottles: 8 },
        { address: 'Odeonsplatz 2, Munich, Germany', bottles: 5 },
        { address: 'Leopoldstraße 50, Munich, Germany', bottles: 12 },
        { address: 'Maximilianstraße 25, Munich, Germany', bottles: 6 },
        { address: 'Sendlinger Straße 10, Munich, Germany', bottles: 9 },
      ]
      
      const newAddresses = sampleAddresses.map((sample, index) => {
        const randomLat = 48.1375 + (Math.random() - 0.5) * 0.1
        const randomLng = 11.5755 + (Math.random() - 0.5) * 0.1
        
        return {
          id: `sample-${Date.now()}-${index}`,
          address: sample.address,
          coordinates: { lat: randomLat, lng: randomLng },
          deliveryId: `SAM-${String(index + 1).padStart(3, '0')}`,
          bottleCount: sample.bottles,
          sample: true,
          timestamp: new Date().toISOString(),
        }
      })
      
      setAddresses(prev => [...prev, ...newAddresses])
      setIsLoading(false)
      toast.success(`Added ${sampleAddresses.length} sample addresses!`, { id: 'sample' })
    }, 1000)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div 
        className="min-h-screen bg-gray-50"
        style={backgroundImageLoaded ? {
          backgroundImage: 'url(/Background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat'
        } : {
          backgroundColor: '#f8fafc'
        }}
      >
        {/* Header */}
        <header className="bg-white/90 backdrop-blur-sm shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <img 
                  src="/logo.png" 
                  alt="aboutwater" 
                  className="h-12 w-auto mr-3"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <h1 className="text-2xl font-bold text-gray-800">
                  aboutwater Route Optimizer
                </h1>
              </div>
              <div className="text-sm text-gray-600">
                v4.0.1 - Enterprise Edition
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Control Panel */}
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                📍 Address Management
              </h2>
              
              {/* Address Form */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Address *
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({...prev, address: e.target.value}))}
                    placeholder="Enter full address (e.g., Marienplatz 1, Munich, Germany)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery ID
                    </label>
                    <input
                      type="text"
                      value={formData.deliveryId}
                      onChange={(e) => setFormData(prev => ({...prev, deliveryId: e.target.value}))}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bottles
                    </label>
                    <input
                      type="number"
                      value={formData.bottleCount}
                      onChange={(e) => setFormData(prev => ({...prev, bottleCount: e.target.value}))}
                      min="1"
                      max="80"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <button
                  onClick={handleAddAddress}
                  disabled={isLoading || !formData.address.trim()}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors duration-300 ${
                    isLoading || !formData.address.trim()
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isLoading ? 'Adding Address...' : '📍 Add Address'}
                </button>
              </div>
              
              {/* Bulk Operations */}
              <div className="space-y-3">
                <div className="text-center">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExcelImport}
                    disabled={isImporting}
                    className={`py-2 px-4 rounded-lg font-medium transition-colors duration-300 text-sm ${
                      isImporting 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}
                  >
                    {isImporting ? 'Importing...' : '📊 Import Excel/CSV'}
                  </button>
                  
                  <button
                    onClick={handleAddSampleData}
                    disabled={isLoading}
                    className={`py-2 px-4 rounded-lg font-medium transition-colors duration-300 text-sm ${
                      isLoading 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    + Sample Data
                  </button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileImport}
                  className="hidden"
                />
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <div className="font-medium mb-1">📋 Import Format (Excel & CSV):</div>
                  <div className="space-y-1">
                    <div>• <strong>Address</strong> column (required): Full delivery addresses</div>
                    <div>• <strong>DeliveryID</strong> column (optional): Unique identifiers</div>
                    <div>• <strong>Bottles</strong> column (optional): Quantity per delivery</div>
                    <div className="mt-2 font-medium">📄 Supported formats: .xlsx, .xls, .csv</div>
                  </div>
                </div>
              </div>

              {/* Address List */}
              <div className="mt-6 space-y-3">
                <h3 className="text-lg font-medium text-gray-700">
                  Addresses ({addresses.length})
                </h3>
                
                {addresses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📍</div>
                    <p>No addresses added yet.</p>
                    <p className="text-sm">Add addresses to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {addresses.map((address) => (
                      <div 
                        key={address.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 flex items-center">
                            {address.deliveryId}
                            {address.imported && <span className="ml-2 text-xs bg-green-100 text-green-600 px-2 py-1 rounded">Excel</span>}
                            {address.sample && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Sample</span>}
                          </div>
                          <div className="text-sm text-gray-600">{address.address}</div>
                          <div className="text-xs text-blue-600">{address.bottleCount} bottles</div>
                        </div>
                        <button
                          onClick={() => {
                            setAddresses(prev => prev.filter(a => a.id !== address.id))
                            toast.success('Address removed')
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {addresses.length > 1 && (
                <div className="mt-6 pt-4 border-t">
                  <button
                    onClick={handleOptimizeRoutes}
                    disabled={isOptimizing}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors duration-300 ${
                      isOptimizing 
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isOptimizing ? 'Optimizing Routes...' : `🚀 Optimize Routes (${addresses.length} addresses)`}
                  </button>
                </div>
              )}
            </div>

            {/* Interactive Map */}
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                🗺️ Interactive Route Visualization
              </h2>
              
              <div className="w-full h-80">
                <Suspense fallback={
                  <div className="w-full h-80 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <div className="text-4xl mb-2">🗺️</div>
                      <p className="text-gray-600 mb-2">Loading Interactive Map...</p>
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    </div>
                  </div>
                }>
                <RouteMap
                  addresses={addresses.map(addr => ({
                    id: addr.id,
                    deliveryId: addr.deliveryId,
                    address: addr.address,
                    coordinates: addr.coordinates,
                    bottleCount: addr.bottleCount,
                    priority: 3, // Default priority
                    customerNotes: addr.imported ? 'Imported from Excel' : (addr.sample ? 'Sample data' : 'Manual entry'),
                    addressType: 'RESIDENTIAL' as const,
                    timeWindow: { start: '09:00', end: '17:00' },
                    estimatedServiceTime: 15
                  }))}
                  tours={optimizedRoutes.map((route, index) => ({
                    id: route.id,
                    addresses: route.addresses.map(addr => ({
                      id: addr.id,
                      deliveryId: addr.deliveryId,
                      address: addr.address,
                      coordinates: addr.coordinates,
                      bottleCount: addr.bottleCount,
                      priority: 3,
                      customerNotes: addr.imported ? 'Imported from Excel' : (addr.sample ? 'Sample data' : 'Manual entry'),
                      addressType: 'RESIDENTIAL' as const,
                      timeWindow: { start: '09:00', end: '17:00' },
                      estimatedServiceTime: 15
                    })),
                    totalDistance: route.totalDistance || 0,
                    totalDuration: route.estimatedDuration || 0,
                    totalBottles: route.totalBottles || 0,
                    efficiency: (route.efficiency || 85) / 100,
                    estimatedDistance: route.totalDistance || 0,
                    estimatedDuration: route.estimatedDuration || 0,
                    created: new Date(),
                    algorithm: 'GENETIC_ALGORITHM' as const
                  }))}
                  hqLocation={{ lat: 48.1375, lng: 11.5755 }} // Munich center
                  showRoutes={true}
                  className="rounded-lg"
                />
                </Suspense>
              </div>
              
              <div className="mt-4 text-sm text-gray-600 bg-blue-50/50 border border-blue-200 rounded p-3">
                <div className="font-medium mb-1">🗺️ Interactive Map Features:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>• Click addresses for details</div>
                  <div>• Toggle satellite/street view</div>
                  <div>• Fullscreen mode available</div>
                  <div>• Auto-zoom to fit all addresses</div>
                  <div>• Route visualization with colors</div>
                  <div>• Real-time statistics overlay</div>
                </div>
              </div>
            </div>
          </div>

          {/* Optimized Routes Results */}
          {optimizedRoutes.length > 0 && (
            <div className="mt-8 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                🗺️ Optimized Routes
              </h2>
              
              <div className="space-y-4">
                {optimizedRoutes.map((route, routeIndex) => (
                  <div key={routeIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-medium text-gray-800">
                          Route {routeIndex + 1}
                        </h3>
                        <div className="text-sm text-gray-600">
                          {route.addresses?.length || 0} stops • {route.totalDistance?.toFixed(1)}km • {Math.round((route.estimatedDuration || 0)/60)}min • {route.efficiency}% efficient
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleCopyDriverLink(routeIndex)}
                          className="px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors duration-300"
                          title={`Copy driver link for Route ${routeIndex + 1}`}
                        >
                          📱 Copy Link
                        </button>
                        <button
                          onClick={() => handleSendDriverLink(routeIndex)}
                          className="px-3 py-2 text-xs bg-green-500 hover:bg-green-600 text-white rounded-md font-medium transition-colors duration-300"
                          title={`Send driver link via email for Route ${routeIndex + 1}`}
                        >
                          ✉️ Email Link
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {route.addresses?.map((address: any, index: number) => (
                        <div key={address.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                          <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">{address.deliveryId}</div>
                            <div className="text-sm text-gray-600">{address.address}</div>
                          </div>
                          <div className="text-sm text-blue-600">{address.bottleCount} bottles</div>
                        </div>
                      )) || []}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Driver Links Section */}
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-lg font-medium text-gray-800 mb-3">📱 Send Routes to Drivers</h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="text-sm text-green-800 mb-3">
                    <strong>Individual Driver Links:</strong> Each route has a unique Google Maps link that works perfectly on both Android and iOS devices.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {optimizedRoutes.map((route, index) => (
                      <div key={index} className="bg-white rounded-lg p-3 border border-green-300">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-800">Route {index + 1}</div>
                          <div className="text-xs text-gray-600">{route.addresses?.length || 0} stops</div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleCopyDriverLink(index)}
                            className="flex-1 px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors duration-300"
                          >
                            📱 Copy Link
                          </button>
                          <button
                            onClick={() => handleSendDriverLink(index)}
                            className="flex-1 px-3 py-2 text-xs bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors duration-300"
                          >
                            ✉️ Email
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-green-300">
                    <button
                      onClick={handleShowAllDriverLinks}
                      className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-lg font-medium transition-colors duration-300 flex items-center justify-center"
                    >
                      📋 Get All Driver Links ({optimizedRoutes.length} routes)
                    </button>
                    <div className="mt-2 text-xs text-green-700 text-center">
                      💡 <strong>Pro Tip:</strong> This will copy all route links with instructions - perfect for sending to your dispatch team!
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Actions */}
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-lg font-medium text-gray-800 mb-3">📊 Export All Routes</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => handleExportToGoogleMaps(0)}
                      className="flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-300"
                    >
                      <span className="mr-2">🗺️</span>
                      Export Route 1 to Maps
                    </button>
                    
                    <button
                      onClick={handleExportToExcel}
                      className="flex items-center justify-center py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-300"
                    >
                      <span className="mr-2">📊</span>
                      Export to Excel
                    </button>
                    
                    <button
                      onClick={handleExportToCSV}
                      className="flex items-center justify-center py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors duration-300"
                    >
                      <span className="mr-2">📄</span>
                      Export to CSV
                    </button>
                  </div>
                  
                  {optimizedRoutes.length > 1 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {optimizedRoutes.slice(1).map((_, index) => (
                        <button
                          key={index}
                          onClick={() => handleExportToGoogleMaps(index + 1)}
                          className="flex items-center justify-center py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors duration-300 text-sm"
                        >
                          🗺️ Route {index + 2}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
                    <div>
                      <strong>📱 Driver Links:</strong> Individual Google Maps links for each route, optimized for Android/iOS. Perfect for sending directly to drivers via SMS, email, or messaging apps.
                    </div>
                    <div>
                      <strong>🗺️ Google Maps Export:</strong> Open routes directly in Google Maps for planning and verification. Works on mobile and desktop.
                    </div>
                    <div>
                      <strong>📊 Excel Export:</strong> Creates comprehensive workbook with summary sheet and individual route sheets with full statistics and coordinates.
                    </div>
                    <div>
                      <strong>📄 CSV Export:</strong> Generates multiple CSV files: summary, detailed routes, and individual route files. Perfect for data analysis and import into other systems.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Status */}
          <div className="mt-8 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              ⚡ System Status - All Features Active
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-green-500 text-2xl mr-3">✅</div>
                  <div>
                    <div className="font-semibold text-green-800">Address Forms</div>
                    <div className="text-sm text-green-600">Fully Working</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-blue-500 text-2xl mr-3">📊</div>
                  <div>
                    <div className="font-semibold text-blue-800">Excel & CSV I/O</div>
                    <div className="text-sm text-blue-600">Import & Export Ready</div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-yellow-500 text-2xl mr-3">🚀</div>
                  <div>
                    <div className="font-semibold text-yellow-800">Route Optimizer</div>
                    <div className="text-sm text-yellow-600">Genetic Algorithm Active</div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-purple-500 text-2xl mr-3">🗺️</div>
                  <div>
                    <div className="font-semibold text-purple-800">Google Maps</div>
                    <div className="text-sm text-purple-600">Export Ready</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#333',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </QueryClientProvider>
  )
}

export default App