export type PaperSize = '58mm' | '80mm';
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
      if (!(navigator as any).usb) {
        throw new Error('WebUSB not supported');
      }
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      await device.claimInterface(0);
      this.config!.deviceId = device.serialNumber || undefined;
      return true;
    } catch (error) {
      console.error('USB connection failed:', error);
      return false;
    }
  }

  private async connectBluetooth(): Promise<boolean> {
    try {
      if (!(navigator as any).bluetooth) {
        throw new Error('WebBluetooth not supported');
      }
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
      });
      this.config!.deviceId = device.id;
      return true;
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      return false;
    }
  }

  private async connectNetwork(): Promise<boolean> {
    if (!this.config?.endpoint) throw new Error('No network endpoint configured');
    try {
      const response = await fetch(this.config.endpoint, { method: 'HEAD' });
      return response.ok;
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
      console.error('Print failed:', error);
      return false;
    }
  }

  private async printUSB(data: Uint8Array): Promise<boolean> {
    if (!(navigator as any).usb) throw new Error('WebUSB not available');
    const devices = await (navigator as any).usb.getDevices();
    const device = devices.find((d: any) => d.serialNumber === this.config?.deviceId);
    if (!device) throw new Error('Printer not found');
    await device.transferOut(1, data);
    return true;
  }

  private async printBluetooth(data: Uint8Array): Promise<boolean> {
    if (!(navigator as any).bluetooth) throw new Error('WebBluetooth not available');
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
    });
    const server = await device.gatt?.connect();
    const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    const characteristic = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
    await characteristic?.writeValue(data.buffer as ArrayBuffer);
    return true;
  }

  private async printNetwork(data: Uint8Array): Promise<boolean> {
    if (!this.config?.endpoint) throw new Error('No endpoint');
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data.buffer as ArrayBuffer,
    });
    return response.ok;
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
