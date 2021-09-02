import DFU from './DFU'
import DFUse from './DFUse'

class DfuFile {
  prefix;
  suffix;
  imagesSection;

  constructor() {
  }
}

class DFUPrefix {
  szSignature;
  bVersion;
  DFUImageSize;
  bTargets;

  constructor() {
  }
}

class DfuImage {
  szSignature;
  bAlternateSetting;
  bTargetNamed;
  szTargetName;
  dwTargetSize;
  dwNbElements;
  imageElements;

  constructor() {
  }
}

class ImageElement {
  dwElementAddress;
  dwElementSize;
  data;

  constructor() {
  }
}

class DFUSuffix {
  bcdDeviceLo;
  bcdDeviceHi;
  idProductLo;
  idProductHi;
  idVendorLo;
  idVendorHi;
  bcdDFULo;
  bcdDFUHi;
  ucDfuSignature;
  bLength;
  dwCRC;

  constructor() {
  }
}

export default {
  DFU: DFU,
  DFUse: DFUse,
  Device: DFUse.Device,

  dfuMap: {},

  /**
   * 解析DFU文件
   * @param firmwareFile
   */
  parseDfuImage(firmwareFile) {
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

  getDfu(device, settings) {
    if (this.dfuMap[device.serialNumber]) {
      return this.dfuMap[device.serialNumber];
    } else {
      let dfu = new DFUse.Device(device, settings)
      this.dfuMap[device.serialNumber] = dfu;
      return dfu;
    }
  },

  /**
   * 正式刷入固件
   * @param deviceSetting
   * @param dfuFile
   */
  async flash(deviceSetting, dfuFile, setting) {
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
      await dfu.do_download(transferSize, onceImg.data, false)
    }
    if (manifestationTolerant) {
      await dfu.manifestationToNew(0x08000000);
    }
    dfu.logInfo('Done!')

    if (!manifestationTolerant) {
      dfu.waitDisconnected(5000).then(
        dev => {
          dfu.logInfo('you can close');
        },
        error => {
          dfu.logError('disconn error ', error)
          // It didn't reset and disconnect for some reason...
          dfu.logError('Device unexpectedly tolerated manifestation.')
          return false
        }
      )
    }
    return true;
  },

  async findAllStm32Device (vendorId) {
    let deviceList = await navigator.usb.getDevices()
    if (deviceList.length <= 0) {
      deviceList = await navigator.usb.requestDevice({filters: [{vendorId: vendorId}]});
    }
    return this.findAllDeviceDfuInterfaces(deviceList)
  },

  async findAllDeviceDfuInterfaces(deviceList) {
    let rv = []
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
