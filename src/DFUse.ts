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

import {DFU, Device, DeviceSettings} from './DFU'
// @ts-ignore
import {USBDevice, USBConfiguration, USBInterface, USBAlternateInterface} from 'w3c-web-usb'

export class DFUse extends DFU {
  constructor() {
    super()
  }

  static get GET_COMMANDS() {
    return 0x00
  }

  static get SET_ADDRESS() {
    return 0x21
  }

  static get ERASE_SECTOR() {
    return 0x41
  }

  static get READ_UNPROTECT() {
    return 0x92
  }

  static parseMemoryDescriptor(desc: string) {
    const nameEndIndex = desc.indexOf('/')
    if (!desc.startsWith('@') || nameEndIndex === -1) {
      throw new Error(`Not a DfuSe memory descriptor: "${desc}"`)
    }

    const name = desc.substring(1, nameEndIndex).trim()
    const segmentString = desc.substring(nameEndIndex)

    let segments = []

    const sectorMultipliers: any = {
      ' ': 1,
      'B': 1,
      'K': 1024,
      'M': 1048576
    }

    let contiguousSegmentRegex = /\/\s*(0x[0-9a-fA-F]{1,8})\s*\/(\s*[0-9]+\s*\*\s*[0-9]+\s?[ BKM]\s*[abcdefg]\s*,?\s*)+/g
    let contiguousSegmentMatch
    while ((contiguousSegmentMatch = contiguousSegmentRegex.exec(segmentString))) {
      let segmentRegex = /([0-9]+)\s*\*\s*([0-9]+)\s?([ BKM])\s*([abcdefg])\s*,?\s*/g
      let startAddress = parseInt(contiguousSegmentMatch[1], 16)
      let segmentMatch
      while ((segmentMatch = segmentRegex.exec(contiguousSegmentMatch[0]))) {
        let segment: any = {}
        let sectorCount = parseInt(segmentMatch[1], 10)
        let sectorSize = parseInt(segmentMatch[2]) * sectorMultipliers[segmentMatch[3]]
        let properties = segmentMatch[4].charCodeAt(0) - 'a'.charCodeAt(0) + 1
        segment.start = startAddress
        segment.sectorSize = sectorSize
        segment.end = startAddress + sectorSize * sectorCount
        segment.readable = (properties & 0x1) !== 0
        segment.erasable = (properties & 0x2) !== 0
        segment.writable = (properties & 0x4) !== 0
        segments.push(segment)

        startAddress += sectorSize * sectorCount
      }
    }

    return {'name': name, 'segments': segments}
  }
}

export class DFUseDevice extends Device {
  private _startAddress: number;
  private memoryInfo: any;

  constructor(device:USBDevice, settings: DeviceSettings) {
    super(device, settings)
    this.memoryInfo = null
    this._startAddress = NaN
  }

  set startAddress(value: number) {
    this._startAddress = value;
  }
  get startAddress(): number {
    return this._startAddress;
  }

  async loadMemoryInfo() {
    let name = null
    if (this.settings.name) {
      name = this.settings.name
    } else {
      let configs = await this.readInterfaceNames()
      name = configs[1][0][this.settings.interface.interfaceNumber]
    }
    this.memoryInfo = DFUse.parseMemoryDescriptor(name)
  }

  async dfuseCommand(command: number, param: number, len: number) {
    if (typeof param === 'undefined' && typeof len === 'undefined') {
      param = 0x00
      len = 1
    }

    const commandNames: any = {
      0x00: 'GET_COMMANDS',
      0x21: 'SET_ADDRESS',
      0x41: 'ERASE_SECTOR',
      0x92: 'READ_UNPROTECT',
    }

    let payload = new ArrayBuffer(len + 1)
    let view = new DataView(payload)
    view.setUint8(0, command)
    if (len === 1) {
      view.setUint8(1, param)
    } else if (len === 4) {
      view.setUint32(1, param, true)
    } else {
      throw new Error('Don\'t know how to handle data of len ' + len)
    }

    try {
      await this.download(payload, 0)
    } catch (error) {
      throw new Error('Error during special DfuSe command ' + commandNames[command] + ':' + error)
    }

    let status = await this.poll_until(state => (state !== DFU.dfuDNBUSY))
    if (status.status !== DFU.STATUS_OK) {
      throw new Error('Special DfuSe command ' + commandNames[command] + ' failed')
    }
  }

  getSegment(addr: number) {
    if (!this.memoryInfo || !this.memoryInfo.segments) {
      throw new Error('No memory map information available')
    }

    for (let segment of this.memoryInfo.segments) {
      if (segment.start <= addr && addr < segment.end) {
        return segment
      }
    }

    return null
  }

  getSectorStart(addr: number, segment: any) {
    if (typeof segment === 'undefined') {
      segment = this.getSegment(addr)
    }

    if (!segment) {
      throw new Error(`Address ${addr.toString(16)} outside of memory map`)
    }

    const sectorIndex = Math.floor((addr - segment.start) / segment.sectorSize)
    return segment.start + sectorIndex * segment.sectorSize
  }

  getSectorEnd(addr: number, segment: any | undefined) {
    if (typeof segment === 'undefined') {
      segment = this.getSegment(addr)
    }

    if (!segment) {
      throw new Error(`Address ${addr.toString(16)} outside of memory map`)
    }

    const sectorIndex = Math.floor((addr - segment.start) / segment.sectorSize)
    return segment.start + (sectorIndex + 1) * segment.sectorSize
  }

  getFirstWritableSegment() {
    if (!this.memoryInfo || !this.memoryInfo.segments) {
      throw new Error('No memory map information available')
    }

    for (let segment of this.memoryInfo.segments) {
      if (segment.writable) {
        return segment
      }
    }

    return null
  }

  getMaxReadSize(startAddr: number) {
    if (!this.memoryInfo || !this.memoryInfo.segments) {
      throw new Error('No memory map information available')
    }

    let numBytes = 0
    for (let segment of this.memoryInfo.segments) {
      if (segment.start <= startAddr && startAddr < segment.end) {
        // Found the first segment the read starts in
        if (segment.readable) {
          numBytes += segment.end - startAddr
        } else {
          return 0
        }
      } else if (segment.start === startAddr + numBytes) {
        // Include a contiguous segment
        if (segment.readable) {
          numBytes += (segment.end - segment.start)
        } else {
          break
        }
      }
    }

    return numBytes
  };

  async erase(startAddr: number, length: number) {
    let segment = this.getSegment(startAddr)
    let addr = this.getSectorStart(startAddr, segment)
    const endAddr = this.getSectorEnd(startAddr + length - 1, undefined)

    let bytesErased = 0
    const bytesToErase = endAddr - addr
    if (bytesToErase > 0) {
      this.logProgress(bytesErased, bytesToErase)
    }

    while (addr < endAddr) {
      if (segment.end <= addr) {
        segment = this.getSegment(addr)
      }
      if (!segment.erasable) {
        // Skip over the non-erasable section
        bytesErased = Math.min(bytesErased + segment.end - addr, bytesToErase)
        addr = segment.end
        this.logProgress(bytesErased, bytesToErase)
        continue
      }
      const sectorIndex = Math.floor((addr - segment.start) / segment.sectorSize)
      const sectorAddr = segment.start + sectorIndex * segment.sectorSize
      this.logDebug(`Erasing ${segment.sectorSize}B at 0x${sectorAddr.toString(16)}`)
      await this.dfuseCommand(DFUse.ERASE_SECTOR, sectorAddr, 4)
      addr = sectorAddr + segment.sectorSize
      bytesErased += segment.sectorSize
      this.logProgress(bytesErased, bytesToErase)
    }
  };

  async do_download(xfer_size: number, data: BufferSource, manifestationTolerant: any) {
    if (!this.memoryInfo || !this.memoryInfo.segments) {
      throw new Error('No memory map available')
    }

    this.logInfo('Erasing DFU device memory')

    let bytes_sent = 0
    let expected_size = data.byteLength

    let startAddress = this._startAddress
    if (isNaN(startAddress)) {
      startAddress = this.memoryInfo.segments[0].start
      this.logWarning('Using inferred start address 0x' + startAddress.toString(16))
    } else if (this.getSegment(startAddress) === null) {
      this.logError(`Start address 0x${startAddress.toString(16)} outside of memory map bounds`)
    }
    await this.erase(startAddress, expected_size)

    this.logInfo('Copying data from browser to DFU device')

    //0. 固件的写入位置设置
    let address = startAddress
    while (bytes_sent < expected_size) {
      const bytes_left = expected_size - bytes_sent
      const chunk_size = Math.min(bytes_left, xfer_size)

      let bytes_written = 0
      let dfu_status
      try {
        this.logDebug('start at >>> 0x' + address.toString(16))
        //1. Set Address Pointer
        await this.dfuseCommand(DFUse.SET_ADDRESS, address, 4)
        this.logDebug(`Set address to 0x${address.toString(16)}`)

        //2. Write memory
        // @ts-ignore
        bytes_written = await this.download(data.slice(bytes_sent, bytes_sent + chunk_size), 2)
        this.logDebug('Sent ' + bytes_written + ' bytes')
        dfu_status = await this.poll_until_idle([DFU.dfuDNLOAD_IDLE, DFU.dfuIDLE])
        address += chunk_size
      } catch (error) {
        console.error(error)
        throw new Error('Error during DfuSe download: ' + error)
      }

      if (dfu_status.status !== DFU.STATUS_OK) {
        throw new Error(`DFU DOWNLOAD failed state=${dfu_status.state}, status=${dfu_status.status}`)
      }

      this.logDebug('Wrote ' + bytes_written + ' bytes')
      bytes_sent += bytes_written

      this.logProgress(bytes_sent, expected_size)
    }
    this.logInfo(`Wrote ${bytes_sent} bytes`)

    if (manifestationTolerant) {
      await this.manifestationToNew(startAddress)
    }
  }

  async manifestationToNew(startAddress: number) {
    this.logInfo('Manifesting new firmware')
    try {
      await this.dfuseCommand(DFUse.SET_ADDRESS, startAddress, 4)
      await this.download(new ArrayBuffer(0), 2)
    } catch (error) {
      throw new Error('Error during DfuSe manifestation: ' + error)
    }

    try {
      await this.poll_until(state => (state === DFU.dfuMANIFEST))
    } catch (error) {
      this.logError(error)
    }
  }

  async doUpload(xfer_size: number, max_size = Infinity) {
    let startAddress = this._startAddress
    if (isNaN(startAddress)) {
      startAddress = this.memoryInfo.segments[0].start
      this.logWarning('Using inferred start address 0x' + startAddress.toString(16))
    } else if (this.getSegment(startAddress) === null) {
      this.logWarning(`Start address 0x${startAddress.toString(16)} outside of memory map bounds`)
    }

    this.logInfo(`Reading up to 0x${max_size.toString(16)} bytes starting at 0x${startAddress.toString(16)}`)
    let state = await this.getState()
    if (state !== DFU.dfuIDLE) {
      await this.abortToIdle()
    }
    await this.dfuseCommand(DFUse.SET_ADDRESS, startAddress, 4)
    await this.abortToIdle()

    // DfuSe encodes the read address based on the transfer size,
    // the block number - 2, and the SET_ADDRESS pointer.
    return await this.do_upload(xfer_size, max_size, 2)
  }

  async do_upload(xfer_size: number, max_size: number, first_block: number) {
    let transaction = first_block
    let blocks = []
    let bytes_read = 0

    this.logInfo('Copying data from DFU device to browser')
    // Initialize progress to 0
    this.logProgress(0, 0)

    let result
    let bytes_to_read
    do {
      bytes_to_read = Math.min(xfer_size, max_size - bytes_read)
      result = await this.upload(bytes_to_read, transaction++)
      this.logDebug('Read ' + result.byteLength + ' bytes')
      if (result.byteLength > 0) {
        blocks.push(result)
        bytes_read += result.byteLength
      }
      if (Number.isFinite(max_size)) {
        this.logProgress(bytes_read, max_size)
      } else {
        this.logProgress(bytes_read, undefined)
      }
    } while ((bytes_read < max_size) && (result.byteLength === bytes_to_read))

    if (bytes_read === max_size) {
      await this.abortToIdle()
    }

    this.logInfo(`Read ${bytes_read} bytes`)

    return new Blob(blocks, {type: 'application/octet-stream'})
  }

  getDFUDescriptorProperties() {
    // Attempt to read the DFU functional descriptor
    // TODO: read the selected configuration's descriptor
    return this.readConfigurationDescriptor(0).then(
      (data: any) => {
        let configDesc = DFU.parseConfigurationDescriptor(data)
        let funcDesc = null
        let configValue = this.settings.configuration.configurationValue
        if (configDesc.bConfigurationValue == configValue) {
          for (let desc of configDesc.descriptors) {
            if (desc.bDescriptorType == 0x21 && desc.hasOwnProperty('bcdDFUVersion')) {
              funcDesc = desc
              break
            }
          }
        }

        if (funcDesc) {
          return {
            WillDetach: ((funcDesc.bmAttributes & 0x08) != 0),
            ManifestationTolerant: ((funcDesc.bmAttributes & 0x04) != 0),
            CanUpload: ((funcDesc.bmAttributes & 0x02) != 0),
            CanDnload: ((funcDesc.bmAttributes & 0x01) != 0),
            TransferSize: funcDesc.wTransferSize,
            DetachTimeOut: funcDesc.wDetachTimeOut,
            DFUVersion: funcDesc.bcdDFUVersion
          }
        } else {
          return {}
        }
      }
    )
  }
}

export default DFUse
