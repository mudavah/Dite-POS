export type PaperSize = '58mm' | '80mm';
import { logger } from '@/lib/logger';
export type PrinterType = 'USB' | 'BLUETOOTH' | 'NETWORK' | 'NODE_HELPER';

export interface PrinterConfig {
  name: string;
  type: PrinterType;
  protocol: 'ESC_POS' | 'RAW';
  paperSize: PaperSize;
  vendorId?: number;
  productId?: number;
  deviceId?: string;
  endpoint?: string;
  ipAddress?: string;
  macAddress?: string;
  port?: number;
}

export interface PrintOptions {
  copies?: number;
  cutter?: boolean;
  buzzer?: boolean;
}

const PAPER_WIDTHS: Record<PaperSize, number> = {
  '58mm': 384,
  '80mm': 576,
};

class ThermalPrinter {
  private config: PrinterConfig | null = null;

  setConfig(config: PrinterConfig) {
    this.config = config;
  }

  getConfig(): PrinterConfig | null {
    return this.config;
  }

  private getPaperWidth(): number {
    return PAPER_WIDTHS[this.config?.paperSize || '80mm'];
  }

  async connect(): Promise<boolean> {
    if (!this.config) throw new Error('No printer configured');

    switch (this.config.type) {
      case 'USB':
        return this.connectUSB();
      case 'BLUETOOTH':
        return this.connectBluetooth();
      case 'NETWORK':
        return this.connectNetwork();
      case 'NODE_HELPER':
        return this.connectNodeHelper();
      default:
        throw new Error(`Unsupported printer type: ${this.config.type}`);
    }
  }

  private async connectUSB(): Promise<boolean> {
    try {
      if (!navigator.usb) {
        throw new Error('WebUSB not supported');
      }
      const device = await navigator.usb.requestDevice({ filters: [] });
      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      await device.claimInterface(0);
      this.config!.deviceId = device.serialNumber || undefined;
      return true;
    } catch (error) {
      logger.error('USB connection failed', error);
      return false;
    }
  }

  private async connectBluetooth(): Promise<boolean> {
    try {
      if (!navigator.bluetooth) {
        throw new Error('WebBluetooth not supported');
      }
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
      });
      this.config!.deviceId = device.id;
      return true;
    } catch (error) {
      logger.error('Bluetooth connection failed', error);
      return false;
    }
  }

  private getEndpoint(): string {
    if (this.config?.endpoint) return this.config.endpoint;
    if (this.config?.ipAddress) {
      const port = this.config.port || 9100;
      const protocol = this.config.endpoint?.startsWith('https') ? 'https' : 'http';
      return `${protocol}://${this.config.ipAddress}:${port}`;
    }
    throw new Error('No printer endpoint configured');
  }

  private getIpAddress(): string | undefined {
    return this.config?.ipAddress;
  }

  private getMacAddress(): string | undefined {
    return this.config?.macAddress;
  }

  private getPort(): number {
    return this.config?.port || 9100;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.config) return { success: false, message: 'No printer configured' };

    try {
      if (this.config.type === 'NETWORK') {
        const endpoint = this.getEndpoint();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(endpoint, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeout);
          if (response.ok) {
            return { success: true, message: `Printer reachable at ${endpoint}` };
          }
          return { success: false, message: `Printer responded with status ${response.status}` };
        } catch {
          clearTimeout(timeout);
          return { success: false, message: `Cannot reach printer at ${endpoint}` };
        }
      }

      if (this.config.type === 'USB') {
        return { success: false, message: 'Use the Connect button for USB printers' };
      }

      if (this.config.type === 'BLUETOOTH') {
        return { success: false, message: 'Use the Connect button for Bluetooth printers' };
      }

      return { success: false, message: 'Connection test not supported for this printer type' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Connection test failed' };
    }
  }

  private async connectNetwork(): Promise<boolean> {
    try {
      const endpoint = this.getEndpoint();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(endpoint, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        return response.ok;
      } catch {
        clearTimeout(timeout);
        return false;
      }
    } catch {
      return false;
    }
  }

  private async connectNodeHelper(): Promise<boolean> {
    if (!this.config?.endpoint) throw new Error('No Node printer helper endpoint configured');
    try {
      const response = await fetch(`${this.config.endpoint}/status`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async print(data: Uint8Array, options: PrintOptions = {}): Promise<boolean> {
    if (!this.config) throw new Error('No printer configured');

    try {
      switch (this.config.type) {
        case 'USB':
          return this.printUSB(data);
        case 'BLUETOOTH':
          return this.printBluetooth(data);
        case 'NETWORK':
          return this.printNetwork(data);
        case 'NODE_HELPER':
          return this.printNodeHelper(data, options);
        default:
          throw new Error(`Unsupported printer type: ${this.config.type}`);
      }
    } catch (error) {
      logger.error('Print failed', error);
      return false;
    }
  }

  private async printUSB(data: Uint8Array): Promise<boolean> {
    if (!navigator.usb) throw new Error('WebUSB not available');
    const devices = await navigator.usb.getDevices();
    const device = devices.find((d) => d.serialNumber === this.config?.deviceId);
    if (!device) throw new Error('Printer not found');
    await device.transferOut(1, data as unknown as BufferSource);
    return true;
  }

  private async printBluetooth(data: Uint8Array): Promise<boolean> {
    if (!navigator.bluetooth) throw new Error('WebBluetooth not available');
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
    });
    const server = await device.gatt?.connect();
    const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    const characteristic = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
    await characteristic?.writeValue(Buffer.from(data.buffer) as unknown as BufferSource);
    return true;
  }

  private async printNetwork(data: Uint8Array): Promise<boolean> {
    if (!this.config) return false;

    try {
      const endpoint = this.getEndpoint();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: data.buffer as ArrayBuffer,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return response.ok;
      } catch {
        clearTimeout(timeout);
        return false;
      }
    } catch {
      return false;
    }
  }

  private async printNodeHelper(data: Uint8Array, options: PrintOptions): Promise<boolean> {
    if (!this.config?.endpoint) throw new Error('No endpoint');
    const response = await fetch(`${this.config.endpoint}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: Array.from(data), options }),
    });
    return response.ok;
  }

  async cut(options: PrintOptions = {}): Promise<boolean> {
    const cutCmd = new Uint8Array([0x1D, 0x56, 0x42, 0x00]);
    return this.print(cutCmd, options);
  }

  async buzzer(options: PrintOptions = {}): Promise<boolean> {
    const buzzerCmd = new Uint8Array([0x1B, 0x1D, 0x07, 0x00, 0x05]);
    return this.print(buzzerCmd, options);
  }
}

export const printer = new ThermalPrinter();
