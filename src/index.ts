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
import DFU, {DeviceSettings, Logger, ProgressHandler} from './DFU'
import DFUse, {DFUseDevice} from './DFUse'
import {Buffer} from "buffer";

class DfuFile {
  public prefix: DFUPrefix | undefined;
  public suffix: DFUSuffix | undefined;
  public imagesSection: Array<DfuImage> = new Array<DfuImage>();

  constructor() {
  }
}

class DFUPrefix {
  szSignature: string | undefined;
  bVersion: number | undefined;
  DFUImageSize: number | undefined;
  bTargets: number | undefined;

  constructor() {
  }
}

class DfuImage {
  szSignature: string | undefined;
  bAlternateSetting: number | undefined;
  bTargetNamed: number | undefined;
  szTargetName: string | undefined;
  dwTargetSize: number | undefined;
  dwNbElements: number | undefined;
  imageElements: Array<ImageElement> = new Array<ImageElement>();

  constructor() {
  }
}

class ImageElement {
  public dwElementAddress: number = 0x08000000;
  public dwElementSize: number | undefined;
  public data: Buffer | undefined;

  constructor() {
  }
}

class DFUSuffix {
  public bcdDeviceLo: number | undefined;
  public bcdDeviceHi: number | undefined;
  public idProductLo: number | undefined;
  public idProductHi: number | undefined;
  public idVendorLo: number | undefined;
  public idVendorHi: number | undefined;
  public bcdDFULo: number | undefined;
  public bcdDFUHi: number | undefined;
  public ucDfuSignature: string | undefined;
  public bLength: number | undefined;
  public dwCRC: Buffer | undefined;

  constructor() {
  }
}

export class FlashSetting {
  public logger: Logger = new Logger();
  public handler: ProgressHandler = (done, total) => {
    console.log(done + '/' + total)
  };
}

const dfuMap: any = {};

export default {
  DFU: DFU,
  DFUse: DFUse,
  Device: DFUseDevice,

  /**
   * 解析DFU文件
   * @param firmwareFile
   */
  parseDfuImage(firmwareFile: Buffer): DfuFile {
    let dfuFile = new DfuFile()
    //- DFU PREFIX
    dfuFile.prefix = new DFUPrefix()
    dfuFile.prefix.szSignature = String(firmwareFile.slice(0, 5));
    dfuFile.prefix.bVersion = firmwareFile.slice(5, 6)[0];
    dfuFile.prefix.DFUImageSize = firmwareFile.slice(6, 10).readInt32LE(0);
    dfuFile.prefix.bTargets = firmwareFile.slice(10, 11)[0];
    /// DFU SUFFIX
    dfuFile.suffix = new DFUSuffix();
    let suffixInd = firmwareFile.byteLength - 16
    dfuFile.suffix.bcdDeviceLo = firmwareFile.slice(suffixInd, suffixInd + 1)[0]
    dfuFile.suffix.bcdDeviceHi = firmwareFile.slice(suffixInd + 1, suffixInd + 2)[0]
    dfuFile.suffix.idProductLo = firmwareFile.slice(suffixInd + 2, suffixInd + 3)[0]
    dfuFile.suffix.idProductHi = firmwareFile.slice(suffixInd + 3, suffixInd + 4)[0]
    dfuFile.suffix.idVendorLo = firmwareFile.slice(suffixInd + 4, suffixInd + 5)[0]
    dfuFile.suffix.idVendorHi = firmwareFile.slice(suffixInd + 5, suffixInd + 6)[0]
    dfuFile.suffix.bcdDFULo = firmwareFile.slice(suffixInd + 6, suffixInd + 7)[0]
    dfuFile.suffix.bcdDFUHi = firmwareFile.slice(suffixInd + 7, suffixInd + 8)[0]
    dfuFile.suffix.ucDfuSignature = String(firmwareFile.slice(suffixInd + 8, suffixInd + 11))
    dfuFile.suffix.bLength = firmwareFile.slice(suffixInd + 11, suffixInd + 12)[0]
    dfuFile.suffix.dwCRC = firmwareFile.slice(suffixInd + 12)

    /// DFU Images section
    dfuFile.imagesSection = [];
    ///-- Target Prefix 274
    let imgTargetPrefixEnd = 11 + 274;
    let imgTargetPrefix = firmwareFile.slice(11, imgTargetPrefixEnd)
    let dfuImage = new DfuImage();
    dfuImage.szSignature = String(imgTargetPrefix.slice(0, 6))
    dfuImage.bAlternateSetting = imgTargetPrefix.slice(6, 7)[0]
    dfuImage.bTargetNamed = imgTargetPrefix.slice(7, 11).readInt32LE(0)
    dfuImage.szTargetName = String(imgTargetPrefix.slice(11, 266))
    dfuImage.dwTargetSize = imgTargetPrefix.slice(266, 270).readInt32LE(0);
    // element size
    dfuImage.dwNbElements = imgTargetPrefix.slice(270).readInt32LE(0)
    dfuFile.imagesSection.push(dfuImage);

    //Image Elements
    let elementStartInd = imgTargetPrefixEnd; // Image Element Start

    dfuImage.imageElements = []
    let tmpData = firmwareFile.slice(elementStartInd);
    for (let i = 0; i < dfuImage.dwNbElements; i++) {
      let imageElement = new ImageElement();
      imageElement.dwElementAddress = tmpData.readInt32LE(0)
      imageElement.dwElementSize = tmpData.readInt32LE(4)
      imageElement.data = tmpData.slice(8, 8 + imageElement.dwElementSize)
      dfuImage.imageElements.push(imageElement)

      // 处理下一个
      tmpData = tmpData.slice(8 + imageElement.dwElementSize)
    }
    return dfuFile;
  },

  getDfu(device: USBDevice, settings: DeviceSettings): DFUseDevice {
    // @ts-ignore
    if (dfuMap[device.serialNumber]) {
      // @ts-ignore
      return dfuMap[device.serialNumber];
    } else {
      let dfu = new DFUseDevice(device, settings)
      // @ts-ignore
      dfuMap[device.serialNumber] = dfu;
      return dfu;
    }
  },

  /**
   * 正式刷入固件
   * @param deviceSetting
   * @param dfuFile
   */
  async flash(deviceSetting: DeviceSettings, dfuFile: DfuFile, setting: FlashSetting) {
    let dfu = this.getDfu(deviceSetting.device, deviceSetting);

    if (setting && setting.logger) {
      dfu.log = setting.logger
    }
    if (setting && setting.handler) {
      dfu.progressHandler = setting.handler
    }

    await dfu.open();
    await dfu.loadMemoryInfo();

    let transferSize = 2048; // 默认值
    let manifestationTolerant = false;
    let desc = await dfu.getDFUDescriptorProperties(); // 获取硬件信息
    if (desc.CanDnload) {
      manifestationTolerant = desc.ManifestationTolerant;
    }
    manifestationTolerant = true;
    transferSize = desc.TransferSize;

    dfu.logDebug('device desc: ', JSON.stringify(desc))
    try {
      let status = await dfu.getStatus();
      if (status.state === DFU.dfuERROR) {
        await dfu.clearStatus();
      }
    } catch (error) {
      dfu.logWarning("Failed to clear status");
    }
    // 刷写所有img
    for (let onceImg of dfuFile.imagesSection[0].imageElements) {
      // 指定起始位置
      dfu.startAddress = onceImg.dwElementAddress;
      // @ts-ignore
      await dfu.do_download(transferSize, onceImg.data, false)
    }
    if (manifestationTolerant) {
      await dfu.manifestationToNew(0x08000000);
    }
    dfu.logInfo('Done!')

    if (!manifestationTolerant) {
      dfu.waitDisconnected(5000).then(
        // @ts-ignore
        (dev: any) => {
          dfu.logInfo('you can close');
        },
        (error: any) => {
          dfu.logError('disconn error ', error)
          // It didn't reset and disconnect for some reason...
          dfu.logError('Device unexpectedly tolerated manifestation.')
          return false
        }
      )
    }
    return true;
  },

  async findAllStm32Device (vendorId: number) {
    let deviceList = await navigator.usb.getDevices()
    if (deviceList.length <= 0) {
      let once: USBDevice = await navigator.usb.requestDevice({filters: [{vendorId: vendorId}]});
      deviceList = new Array<USBDevice>();
      deviceList.push(once)
    }
    return this.findAllDeviceDfuInterfaces(deviceList)
  },

  async findAllDeviceDfuInterfaces(deviceList: Array<USBDevice>) {
    let rv: Array<DeviceSettings> = []
    for (let device of deviceList) {
      let tmp = DFU.findDeviceDfuInterfaces(device)
      let dfu = this.getDfu(device, tmp[0]);
      await dfu.open();
      let configs = (await dfu.readInterfaceNames()) [1][0]
      let ind = 0;
      for (let tmpOnce of tmp) {
        tmpOnce.name = configs[ind++]
      }
      rv = rv.concat(tmp)
    }
    return rv
  },

}
