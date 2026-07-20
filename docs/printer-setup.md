# Thermal Printer Setup Guide

Dite POS supports ESC/POS thermal printers via WebUSB, WebBluetooth, and network connections.

## Supported Printers

- **Epson** TM-series (TM-T20, TM-T88, TM-M30, etc.)
- **Generic USB thermal printers** with ESC/POS support
- **Network printers** (Ethernet/Wi-Fi)
- **Paper sizes**: 58mm and 80mm

## Printer Configuration

1. Navigate to **Settings** > **Printer Configuration**
2. Click **Add Printer**
3. Configure the following:
   - **Name**: Printer identifier
   - **Type**: USB, Network, or Bluetooth
   - **Protocol**: ESC_POS (default)
   - **Paper Size**: 58mm or 80mm
   - **Vendor ID / Product ID**: For USB printers (optional)
   - **Endpoint**: IP address or hostname for network printers

## WebUSB Printing

Modern browsers support WebUSB for direct USB printer access:

1. Connect your thermal printer via USB
2. Ensure the browser has USB permission
3. Configure the printer in Dite POS settings
4. The system will automatically detect and use WebUSB

## WebBluetooth Printing

For Bluetooth thermal printers:

1. Pair the printer with your device via system Bluetooth settings
2. In Dite POS, select Bluetooth printer type
3. The system will discover and connect via WebBluetooth API

## Network Printing

For network-connected printers:

1. Ensure the printer is on the same network
2. Configure the printer IP address in settings
3. The system sends raw ESC/POS commands via TCP/IP

## ESC/POS Commands

Dite POS generates standard ESC/POS commands for:
- Text printing with multiple character encodings
- Barcode generation (Code 128, Code 39, EAN-13)
- QR code generation
- Paper cutting
- Cash drawer kick
- Bold, underline, and font styling

## Receipt Template

Customize receipts in **Settings** > **Receipt Template**:
- Shop name and logo
- Branch information
- Receipt numbering format
- Footer text
- Tax display settings

## Troubleshooting

### Printer Not Detected
- Ensure the printer is powered on and connected
- Check USB/Bluetooth permissions in browser
- Try refreshing the page and reconnecting

### Print Quality Issues
- Check paper roll installation
- Clean printer head
- Verify correct paper density settings

### Connection Drops
- For USB: Try a different USB port
- For Bluetooth: Re-pair the device
- For Network: Verify IP address and firewall settings

## Browser Compatibility

| Browser | WebUSB | WebBluetooth |
|---------|--------|--------------|
| Chrome | Yes | Yes |
| Edge | Yes | Yes |
| Firefox | No | No |
| Safari | No | No |

For unsupported browsers, use the **Local Node Printer Helper** fallback.
