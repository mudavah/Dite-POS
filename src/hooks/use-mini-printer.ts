'use client';

import { useState } from 'react';

type PrinterType = 'USB' | 'BLUETOOTH' | 'NETWORK' | 'NODE_HELPER';

interface PrinterState {
  type: PrinterType;
  deviceId?: string;
  name?: string;
  connected: boolean;
  error?: string;
}

export function useMiniPrinter() {
  const [printer, setPrinter] = useState<PrinterState>({
    type: 'USB',
    connected: false,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const connectUSB = async (): Promise<boolean> => {
    try {
      if (!(navigator as any).usb) {
        throw new Error('WebUSB is not supported in this browser. Use Chrome or Edge.');
      }
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      await device.claimInterface(0);
      setPrinter({
        type: 'USB',
        deviceId: device.serialNumber || device.productName,
        name: device.productName,
        connected: true,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'USB connection failed';
      setPrinter((p) => ({ ...p, error: message }));
      return false;
    }
  };

  const connectBluetooth = async (): Promise<boolean> => {
    try {
      if (!(navigator as any).bluetooth) {
        throw new Error('WebBluetooth is not supported in this browser. Use Chrome or Edge.');
      }
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
      });
      setPrinter({
        type: 'BLUETOOTH',
        deviceId: device.id,
        name: device.name,
        connected: true,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bluetooth connection failed';
      setPrinter((p) => ({ ...p, error: message }));
      return false;
    }
  };

  const connect = async (): Promise<boolean> => {
    setIsConnecting(true);
    setPrinter((p) => ({ ...p, error: undefined }));

    let success = false;
    if (printer.type === 'USB') {
      success = await connectUSB();
    } else if (printer.type === 'BLUETOOTH') {
      success = await connectBluetooth();
    }

    setIsConnecting(false);
    return success;
  };

  const print = async (data: Uint8Array): Promise<boolean> => {
    if (!printer.connected) {
      setPrinter((p) => ({ ...p, error: 'Printer not connected' }));
      return false;
    }

    setIsPrinting(true);
    try {
      if (printer.type === 'USB') {
        const devices = await (navigator as any).usb.getDevices();
        const device = devices.find((d: any) => d.serialNumber === printer.deviceId);
        if (!device) throw new Error('Printer not found. Reconnect USB.');
        await device.transferOut(1, data);
        setPrinter((p) => ({ ...p, error: undefined }));
        return true;
      }

      if (printer.type === 'BLUETOOTH') {
        const device = await (navigator as any).bluetooth.requestDevice({
          filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        });
        const server = await device.gatt?.connect();
        const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const characteristic = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
        await characteristic?.writeValue(data.buffer as ArrayBuffer);
        setPrinter((p) => ({ ...p, error: undefined }));
        return true;
      }

      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Print failed';
      setPrinter((p) => ({ ...p, error: message }));
      return false;
    } finally {
      setIsPrinting(false);
    }
  };

  const disconnect = () => {
    setPrinter({ type: printer.type, connected: false, deviceId: undefined, name: undefined });
  };

  return {
    printer,
    isConnecting,
    isPrinting,
    setPrinterType: (type: PrinterType) => setPrinter((p) => ({ ...p, type, error: undefined })),
    connect,
    print,
    disconnect,
  };
}
