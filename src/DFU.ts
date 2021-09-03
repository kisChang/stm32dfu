/**
 * MIT License
 *
 * Copyright (c) 2021 KisChang
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
'use strict'
// @ts-ignore
import {USBDevice, USBConfiguration, USBInterface, USBAlternateInterface} from 'w3c-web-usb'

/*
 * Static DFU class.
 */
export class DFU {
  constructor() {
  }

  static get DETACH() {
    return 0x00
  }

  static get DNLOAD() {
    return 0x01
  }

  static get UPLOAD() {
    return 0x02
  }

  static get GETSTATUS() {
    return 0x03
  }

  static get CLRSTATUS() {
    return 0x04
  }

  static get GETSTATE() {
    return 0x05
  }

  static get ABORT() {
    return 0x06
  }

  static get appIDLE() {
    return 0x00
  }

  static get appDETACH() {
    return 0x01
  }

  static get dfuIDLE() {
    return 0x02
  }

  static get dfuDNLOAD_SYNC() {
    return 3
  }

  static get dfuDNBUSY() {
    return 4
  }

  static get dfuDNLOAD_IDLE() {
    return 5
  }

  static get dfuMANIFEST_SYNC() {
    return 6
  }

  static get dfuMANIFEST() {
    return 7
  }

  static get dfuMANIFEST_WAIT_RESET() {
    return 8
  }

  static get dfuUPLOAD_IDLE() {
    return 9
  }

  static get dfuERROR() {
    return 0x0A
  }

  static get dfuUPLOADSYNC() {
    return 0x91
  }

  static get dfuUPLOADBUSY() {
    return 0x92
  }

  static get STATUS_OK() {
    return 0x0
  }

  static get STATUS_errTARGET() {
    return 0x01
  }

  static get STATUS_errFILE() {
    return 0x02
  }

  static get STATUS_errWRITE() {
    return 0x03
  }

  static get STATUS_errERASE() {
    return 0x04
  }

  static get STATUS_errCHECK_ERASE() {
    return 0x05
  }

  static get STATUS_errPROG() {
    return 0x06
  }

  static get STATUS_errVERIFY() {
    return 0x07
  }

  static get STATUS_errADDRESS() {
    return 0x08
  }

  static get STATUS_errNOTDONE() {
    return 0x09
  }

  static get STATUS_errFIRMWARE() {
    return 0x0A
  }

  static get STATUS_errVENDOR() {
    return 0x0B
  }

  static get STATUS_errUSBR() {
    return 0x0C
  }

  static get STATUS_errPOR() {
    return 0x0D
  }

  static get STATUS_errUNKNOWN() {
    return 0x0E
  }

  static get STATUS_errSTALLEDPKT() {
    return 0x0F
  }

  static get ATTR_DNLOAD_CAPABLE() {
    return 0x01
  }

  static get ATTR_UPLOAD_CAPABLE() {
    return 0x02
  }

  static get ATTR_MANIFESTATION_TOLERANT() {
    return 0x04
  }

  static get ATTR_WILL_DETACH() {
    return 0x08
  }

  static get ATTR_ST_CAN_ACCELERATE() {
    return 0x80
  }

  static findDeviceDfuInterfaces(device: USBDevice): DeviceSettings[] {
    let interfaces = new Array<DeviceSettings>();
    for (let conf of device.configurations) {
      for (let intf of conf.interfaces) {
        for (let alt of intf.alternates) {
          if (alt.interfaceClass === 0xFE &&
            alt.interfaceSubclass === 0x01 &&
            (alt.interfaceProtocol === 0x01 || alt.interfaceProtocol === 0x02)) {
            let set = new DeviceSettings()
            set.configuration = conf
            set.interface = intf
            set.alternate = alt
            set.name = alt.interfaceName
            set.device = device

            interfaces.push(set)
          }
        }
      }
    }
    return interfaces
  }

  static parseDeviceDescriptor(data: DataView) {
    return {
      bLength: data.getUint8(0),
      bDescriptorType: data.getUint8(1),
      bcdUSB: data.getUint16(2, true),
      bDeviceClass: data.getUint8(4),
      bDeviceSubClass: data.getUint8(5),
      bDeviceProtocol: data.getUint8(6),
      bMaxPacketSize: data.getUint8(7),
      idVendor: data.getUint16(8, true),
      idProduct: data.getUint16(10, true),
      bcdDevice: data.getUint16(12, true),
      iManufacturer: data.getUint8(14),
      iProduct: data.getUint8(15),
      iSerialNumber: data.getUint8(16),
      bNumConfigurations: data.getUint8(17),
    }
  }

  static parseConfigurationDescriptor(data: DataView) {
    let descriptorData = new DataView(data.buffer.slice(9))
    let descriptors = DFU.parseSubDescriptors(descriptorData)
    return {
      bLength: data.getUint8(0),
      bDescriptorType: data.getUint8(1),
      wTotalLength: data.getUint16(2, true),
      bNumInterfaces: data.getUint8(4),
      bConfigurationValue: data.getUint8(5),
      iConfiguration: data.getUint8(6),
      bmAttributes: data.getUint8(7),
      bMaxPower: data.getUint8(8),
      descriptors: descriptors
    }
  }

  static parseInterfaceDescriptor(data: DataView): any {
    return {
      bLength: data.getUint8(0),
      bDescriptorType: data.getUint8(1),
      bInterfaceNumber: data.getUint8(2),
      bAlternateSetting: data.getUint8(3),
      bNumEndpoints: data.getUint8(4),
      bInterfaceClass: data.getUint8(5),
      bInterfaceSubClass: data.getUint8(6),
      bInterfaceProtocol: data.getUint8(7),
      iInterface: data.getUint8(8),
      descriptors: []
    }
  }

  static parseFunctionalDescriptor(data: DataView) {
    return {
      bLength: data.getUint8(0),
      bDescriptorType: data.getUint8(1),
      bmAttributes: data.getUint8(2),
      wDetachTimeOut: data.getUint16(3, true),
      wTransferSize: data.getUint16(5, true),
      bcdDFUVersion: data.getUint16(7, true)
    }
  }

  static parseSubDescriptors(descriptorData: any) {
    const DT_INTERFACE = 4
    // const DT_ENDPOINT = 5;
    const DT_DFU_FUNCTIONAL = 0x21
    const USB_CLASS_APP_SPECIFIC = 0xFE
    const USB_SUBCLASS_DFU = 0x01
    let remainingData = descriptorData
    let descriptors = []
    let currIntf
    let inDfuIntf = false
    while (remainingData.byteLength > 2) {
      let bLength = remainingData.getUint8(0)
      let bDescriptorType = remainingData.getUint8(1)
      let descData = new DataView(remainingData.buffer.slice(0, bLength))
      if (bDescriptorType === DT_INTERFACE) {
        currIntf = DFU.parseInterfaceDescriptor(descData)
        if (currIntf.bInterfaceClass === USB_CLASS_APP_SPECIFIC &&
          currIntf.bInterfaceSubClass === USB_SUBCLASS_DFU) {
          inDfuIntf = true
        } else {
          inDfuIntf = false
        }
        descriptors.push(currIntf)
      } else if (inDfuIntf && bDescriptorType === DT_DFU_FUNCTIONAL) {
        let funcDesc = DFU.parseFunctionalDescriptor(descData)
        descriptors.push(funcDesc)
        currIntf.descriptors.push(funcDesc)
      } else {
        let desc = {
          bLength: bLength,
          bDescriptorType: bDescriptorType,
          data: descData
        }
        descriptors.push(desc)
        if (currIntf) {
          currIntf.descriptors.push(desc)
        }
      }
      remainingData = new DataView(remainingData.buffer.slice(bLength))
    }

    return descriptors
  }
}

export class DeviceSettings {
  public configuration: USBConfiguration;
  public interface: USBInterface;
  public alternate: USBAlternateInterface;
  public name: string = '';
  public device: USBDevice;
}

export class Logger {
  debug(...data: any) {
    console.debug(data)
  }

  info(...data: any) {
    console.log(data)
  }

  log(...data: any) {
    this.info(data);
  }

  warn(...data: any) {
    console.warn(data)
  }

  error(...data: any) {
    console.error(data)
  }
}

export interface ProgressHandler {
  (done: number, total: number | undefined): void
}

/**
 * Represents a DFU-enabled connected device.
 */
export class Device {
  protected device_: USBDevice;
  protected settings: DeviceSettings;
  protected intfNumber: number;

  protected _log: Logger;
  protected _progressHandler: ProgressHandler;

  constructor(device: USBDevice, settings: DeviceSettings) {
    this.device_ = device
    this.settings = settings
    this.intfNumber = settings.interface.interfaceNumber

    this._log = new Logger();
    this._progressHandler = (done, total) => {
      console.log(done + '/' + total)
    };
  }

  set log(value: Logger) {
    this._log = value
  }

  set progressHandler(value: ProgressHandler) {
    this._progressHandler = value
  }

  logDebug(...msg: any) {
    this._log.debug(msg)
  }

  logInfo(...msg: any) {
    this._log.info(msg)
  }

  logWarning(...msg: any) {
    this._log.warn(msg)
  }

  logError(...msg: any) {
    this._log.error(msg)
  }

  logProgress(done: number, total: number | undefined) {
    if (this._progressHandler) {
      this._progressHandler(done, total ? total : done);
    }
  }

  // @ts-ignore
  async open() {
    if (this.device_.opened) {
      return
    }
    await this.device_.open()
    const confValue = this.settings.configuration.configurationValue
    if (this.device_.configuration === null ||
      this.device_.configuration.configurationValue !== confValue) {
      await this.device_.selectConfiguration(confValue)
    }

    const intfNumber = this.settings['interface'].interfaceNumber
    if (!this.device_.configuration.interfaces[intfNumber].claimed) {
      await this.device_.claimInterface(intfNumber)
    }

    const altSetting = this.settings.alternate.alternateSetting
    let intf = this.device_.configuration.interfaces[intfNumber]
    if (intf.alternate === null ||
      intf.alternate.alternateSetting !== altSetting) {
      await this.device_.selectAlternateInterface(intfNumber, altSetting)
    }
  }

  async close() {
    try {
      await this.device_.close()
    } catch (error) {
      console.log(error)
    }
  }

  readDeviceDescriptor() {
    const GET_DESCRIPTOR = 0x06
    const DT_DEVICE = 0x01
    const wValue = (DT_DEVICE << 8)

    return this.device_.controlTransferIn({
      'requestType': 'standard',
      'recipient': 'device',
      'request': GET_DESCRIPTOR,
      'value': wValue,
      'index': 0
    }, 18).then(
      (result: any) => {
        if (result.status === 'ok') {
          return Promise.resolve(result.data)
        } else {
          return Promise.reject(result.status)
        }
      }
    )
  }

  async readStringDescriptor(index: number, langID: number | undefined) {
    if (typeof langID === 'undefined') {
      langID = 0
    }

    const GET_DESCRIPTOR = 0x06
    const DT_STRING = 0x03
    const wValue = (DT_STRING << 8) | index

    const request_setup = {
      'requestType': 'standard',
      'recipient': 'device',
      'request': GET_DESCRIPTOR,
      'value': wValue,
      'index': langID
    }

    // Read enough for bLength
    var result = await this.device_.controlTransferIn(request_setup, 1)

    if (result.status === 'ok') {
      // Retrieve the full descriptor
      const bLength = result.data.getUint8(0)
      result = await this.device_.controlTransferIn(request_setup, bLength)
      if (result.status === 'ok') {
        const len = (bLength - 2) / 2
        let u16_words = []
        for (let i = 0; i < len; i++) {
          u16_words.push(result.data.getUint16(2 + i * 2, true))
        }
        if (langID === 0) {
          // Return the langID array
          return u16_words
        } else {
          // Decode from UCS-2 into a string
          return String.fromCharCode.apply(String, u16_words)
        }
      }
    }

    throw new Error(`Failed to read string descriptor ${index}: ${result.status}`)
  }

  async readInterfaceNames() {
    const DT_INTERFACE = 4

    let configs: any = {}
    let allStringIndices: any = new Set()
    for (let configIndex = 0; configIndex < this.device_.configurations.length; configIndex++) {
      const rawConfig = await this.readConfigurationDescriptor(configIndex)
      let configDesc = DFU.parseConfigurationDescriptor(rawConfig)
      let configValue = configDesc.bConfigurationValue
      configs[configValue] = {}

      // Retrieve string indices for interface names
      for (let desc of configDesc.descriptors) {
        if (desc.bDescriptorType === DT_INTERFACE) {
          if (!(desc.bInterfaceNumber in configs[configValue])) {
            configs[configValue][desc.bInterfaceNumber] = {}
          }
          configs[configValue][desc.bInterfaceNumber][desc.bAlternateSetting] = desc.iInterface
          if (desc.iInterface > 0) {
            allStringIndices.add(desc.iInterface)
          }
        }
      }
    }

    let strings: any = {}
    // Retrieve interface name strings
    for (let index of allStringIndices) {
      try {
        strings[index] = await this.readStringDescriptor(index, 0x0409)
      } catch (error) {
        console.log(error)
        strings[index] = null
      }
    }

    for (let configValue in configs) {
      for (let intfNumber in configs[configValue]) {
        for (let alt in configs[configValue][intfNumber]) {
          const iIndex = configs[configValue][intfNumber][alt]
          configs[configValue][intfNumber][alt] = strings[iIndex]
        }
      }
    }

    return configs
  }

  readConfigurationDescriptor(index: number) {
    const GET_DESCRIPTOR = 0x06
    const DT_CONFIGURATION = 0x02
    const wValue = ((DT_CONFIGURATION << 8) | index)

    return this.device_.controlTransferIn({
      'requestType': 'standard',
      'recipient': 'device',
      'request': GET_DESCRIPTOR,
      'value': wValue,
      'index': 0
    }, 4).then(
      (result: USBInTransferResult) => {
        if (result.status === 'ok') {
          // Read out length of the configuration descriptor
          // @ts-ignore
          let wLength = result.data.getUint16(2, true)
          return this.device_.controlTransferIn({
            'requestType': 'standard',
            'recipient': 'device',
            'request': GET_DESCRIPTOR,
            'value': wValue,
            'index': 0
          }, wLength)
        } else {
          return Promise.reject(result.status)
        }
      }
    ).then(
      (result: USBInTransferResult) => {
        if (result.status === 'ok') {
          return Promise.resolve(result.data)
        } else {
          return Promise.reject(result.status)
        }
      }
    )
  }

  requestOut(bRequest: number, data?: BufferSource, wValue = 0) {
    return this.device_.controlTransferOut({
      'requestType': 'class',
      'recipient': 'interface',
      'request': bRequest,
      'value': wValue,
      'index': this.intfNumber
    }, data).then(
      (result: USBOutTransferResult) => {
        if (result.status === 'ok') {
          return Promise.resolve(result.bytesWritten)
        } else {
          return Promise.reject(result.status)
        }
      },
      (error: any) => {
        console.error(error)
        return Promise.reject('ControlTransferOut failed: ' + error)
      }
    )
  }

  requestIn(bRequest: number, wLength: number, wValue: number = 0) {
    return this.device_.controlTransferIn({
      'requestType': 'class',
      'recipient': 'interface',
      'request': bRequest,
      'value': wValue,
      'index': this.intfNumber
    }, wLength).then(
      (result: USBInTransferResult) => {
        if (result.status === 'ok') {
          return Promise.resolve(result.data)
        } else {
          return Promise.reject(result.status)
        }
      },
      (error: any) => {
        console.error(error)
        return Promise.reject('ControlTransferIn failed: ' + error)
      }
    )
  }

  detach() {
    return this.requestOut(DFU.DETACH, undefined, 1000)
  }

  async waitDisconnected(timeout: number) {
    let device = this
    let usbDevice = this.device_
    return new Promise(function (resolve, reject) {
      let timeoutID = -1
      if (timeout > 0) {
        // @ts-ignore
        timeoutID = setTimeout(reject, timeout)
      }

      function onDisconnect(event: any) {
        if (event.device === usbDevice) {
          if (timeout > 0) {
            clearTimeout(timeoutID)
          }
          // device.disconnected = true
          navigator.usb.removeEventListener('disconnect', onDisconnect)
          event.stopPropagation()
          resolve(device)
        }
      }

      navigator.usb.addEventListener('disconnect', onDisconnect)
    })
  }

  async async_sleep(duration_ms: number) {
    return new Promise((resolve) => {
      this.logDebug('Sleeping for ' + duration_ms + 'ms')
      setTimeout(resolve, duration_ms)
    })
  }

  download(data: BufferSource, wValue: number) {
    return this.requestOut(DFU.DNLOAD, data, wValue)
  }

  upload(length: number, blockNum: number) {
    return this.requestIn(DFU.UPLOAD, length, blockNum)
  }

  clearStatus() {
    return this.requestOut(DFU.CLRSTATUS)
  }

  getStatus() {
    return this.requestIn(DFU.GETSTATUS, 6, 0).then(
      (data: DataView) =>
        Promise.resolve({
          'status': data.getUint8(0),
          'pollTimeout': data.getUint32(1, true) & 0xFFFFFF,
          'state': data.getUint8(4)
        }),
      (error: any) => Promise.reject('DFU GETSTATUS failed: ' + error)
    )
  }

  getState() {
    return this.requestIn(DFU.GETSTATE, 1).then(
      (data: DataView) => Promise.resolve(data.getUint8(0)),
      (error: any) => Promise.reject('DFU GETSTATE failed: ' + error)
    )
  }

  abort() {
    return this.requestOut(DFU.ABORT)
  }

  async abortToIdle() {
    await this.abort()
    let state = await this.getState()
    if (state === DFU.dfuERROR) {
      await this.clearStatus()
      state = await this.getState()
    }
    if (state !== DFU.dfuIDLE) {
      throw new Error('Failed to return to idle state after abort: state ' + state.state)
    }
  }

  async poll_until(state_predicate: (state: number) => boolean) {
    let dfu_status = await this.getStatus()

    while (!state_predicate(dfu_status.state) && dfu_status.state !== DFU.dfuERROR) {
      await this.async_sleep(dfu_status.pollTimeout)
      dfu_status = await this.getStatus()
    }

    return dfu_status
  }

  poll_until_idle(idle_state: any) {
    return this.poll_until((state: number) => {
      if (idle_state.length > 0) {
        return idle_state.indexOf(state) >= 0
      } else {
        return state === idle_state
      }
    })
  }
}

export default DFU
