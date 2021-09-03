# stm32dfu.js

这是 Javascript 主机 [USB DFU](http://wiki.openmoko.org/wiki/USB_DFU) 驱动程序的工具库。
利用 [WebUSB](https://wicg.github.io/webusb/) 草案标准从浏览器实现 USB 固件更新。

基于: [webdfu](https://github.com/devanlai/webdfu)

[![stm32dfu Logo](https://nodei.co/npm/stm32dfu.png)](https://www.npmjs.com/package/stm32dfu)

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]

## 快速使用

```bash
npm install stm32dfu
```

```javascript
// init and conn
import stm32dfu from 'stm32dfu'
let deviceSettings = stm32dfu.findAllStm32Device(0x0483)  //修改0x0483为对应的vendorId
stm32dfu.getDfu(deviceSettings[0].device, deviceSettings[0])

// load dfu and flash
let dfuFile = stm32dfu.parseDfuImage([Blob])
let flashSetting = {
  logger : {
    debug: (...data) => {console.log(data)},
    info: (...data) => {console.log(data)},
    warn: (...data) => {console.log(data)},
    error: (...data) => {console.log(data)},
  },
  handler: (done, total) => {
    console.log(`${done} / ${total}`)
  }
}
stm32dfu.flash(deviceSettings[0], dfuFile, flashSetting).then()
```

## TODO

- [ ] Github Pages 演示页面完善
- [x] 使用TypeScript重写

## Demos
### stm32dfu
https://kischang.github.io/stm32dfu/example/

### dfu-util
A demo re-implementing dfu-util functionality in the browser:

https://devanlai.github.io/webdfu/dfu-util/

