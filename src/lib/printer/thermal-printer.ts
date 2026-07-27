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
  cutter?: boolean;
}

export interface PrintOptions {
  copies?: number;
  cutter?: boolean;
  buzzer?: boolean;
  retries?: number;
}

export interface PrintResult {
  success: boolean;
  message: string;
  error?: string;
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

  async print(data: Uint8Array, options: PrintOptions = {}): Promise<PrintResult> {
    if (!this.config) {
      return { success: false, message: 'No printer configured', error: 'No printer configured' };
    }

    const retries = options.retries ?? 2;
    let lastError: string = '';

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        switch (this.config.type) {
          case 'USB':
            return await this.printUSB(data);
          case 'BLUETOOTH':
            return await this.printBluetooth(data);
          case 'NETWORK':
            return await this.printNetwork(data);
          case 'NODE_HELPER':
            return await this.printNodeHelper(data, options);
          default:
            throw new Error(`Unsupported printer type: ${this.config.type}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown print error';
        logger.error(`Print attempt ${attempt + 1} failed`, error);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    logger.error('Print failed after all retries', { error: lastError, attempts: retries + 1 });
    return { success: false, message: `Print failed after ${retries + 1} attempt(s): ${lastError}`, error: lastError };
  }

  private async printUSB(data: Uint8Array): Promise<PrintResult> {
    if (!navigator.usb) {
      return { success: false, message: 'WebUSB not available', error: 'WebUSB not available' };
    }
    try {
      const devices = await navigator.usb.getDevices();
      const device = devices.find((d) => d.serialNumber === this.config?.deviceId);
      if (!device) {
        return { success: false, message: 'Printer not found. Reconnect USB device.', error: 'Printer not found' };
      }
      await device.transferOut(1, data as unknown as BufferSource);
      return { success: true, message: 'Print sent via USB' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'USB print failed';
      logger.error('USB print failed', error);
      return { success: false, message, error: message };
    }
  }

  private async printBluetooth(data: Uint8Array): Promise<PrintResult> {
    if (!navigator.bluetooth) {
      return { success: false, message: 'WebBluetooth not available', error: 'WebBluetooth not available' };
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
      });
      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      await characteristic?.writeValue(Buffer.from(data.buffer) as unknown as BufferSource);
      return { success: true, message: 'Print sent via Bluetooth' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bluetooth print failed';
      logger.error('Bluetooth print failed', error);
      return { success: false, message, error: message };
    }
  }

  private async printNetwork(data: Uint8Array): Promise<PrintResult> {
    if (!this.config) {
      return { success: false, message: 'No printer configured', error: 'No printer configured' };
    }

    try {
      const endpoint = this.getEndpoint();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: data.buffer as ArrayBuffer,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok) {
          return { success: true, message: `Print sent to ${endpoint}` };
        }
        return { success: false, message: `Printer responded with status ${response.status}`, error: `HTTP ${response.status}` };
      } catch {
        clearTimeout(timeout);
        return { success: false, message: `Cannot reach printer at ${endpoint}`, error: 'Network unreachable' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network print failed';
      logger.error('Network print failed', error);
      return { success: false, message, error: message };
    }
  }

  private async printNodeHelper(data: Uint8Array, options: PrintOptions): Promise<PrintResult> {
    if (!this.config?.endpoint) {
      return { success: false, message: 'No endpoint configured', error: 'No endpoint configured' };
    }
    try {
      const response = await fetch(`${this.config.endpoint}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: Array.from(data), options }),
      });
      if (response.ok) {
        return { success: true, message: 'Print sent via Node helper' };
      }
      const errBody = await response.text().catch(() => '');
      return { success: false, message: `Node helper returned ${response.status}: ${errBody}`, error: errBody };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Node helper print failed';
      logger.error('Node helper print failed', error);
      return { success: false, message, error: message };
    }
  }

  async cut(options: PrintOptions = {}): Promise<PrintResult> {
    const cutCmd = new Uint8Array([0x1D, 0x56, 0x42, 0x00]);
    return this.print(cutCmd, options);
  }

  async buzzer(options: PrintOptions = {}): Promise<PrintResult> {
    const buzzerCmd = new Uint8Array([0x1B, 0x1D, 0x07, 0x00, 0x05]);
    return this.print(buzzerCmd, options);
  }
}

export const printer = new ThermalPrinter();
